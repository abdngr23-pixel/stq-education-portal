"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Role } from "@/types/auth";
import { DashboardSantriSummary } from "./beranda-module";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ajukanIzinAction, verifikasiIzinAction, getPerizinanListAction } from "@/app/actions/kesantrian";
import { WhatsAppDialog } from "@/components/ui/whatsapp-dialog";
import { buildIzinSantriWAMessage } from "@/lib/whatsapp";
import {
  Send,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

export interface IzinItem {
  id: string;
  kodeIzin: string;
  santriNama: string;
  santriNis?: string;
  kelas: string;
  jenis: "PULANG" | "KELUAR_KOMPLEK" | "SAKIT";
  durasi: string;
  alasan: string;
  status: "MENUNGGU_MK" | "MENUNGGU_KS" | "DISETUJUI" | "DITOLAK";
  diverifikasiOleh?: string;
}

export interface PerizinanModuleProps {
  userRole: Role;
  currentUserName: string;
  santriList: DashboardSantriSummary[];
  izinList: IzinItem[];
  onIzinUpdated?: () => void;
}

export function PerizinanModule({
  userRole,
  currentUserName,
  santriList,
  izinList: initialIzinList,
  onIzinUpdated,
}: PerizinanModuleProps) {
  const [list, setList] = useState<IzinItem[]>(initialIzinList);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load perizinan riil dari server action on mount
  useEffect(() => {
    let isMounted = true;
    getPerizinanListAction().then((res) => {
      if (isMounted && res.success && res.data && res.data.length > 0) {
        setList(
          res.data.map((item) => {
            const diffDays = Math.max(
              1,
              Math.round(
                (new Date(item.tanggalSelesai).getTime() - new Date(item.tanggalMulai).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            return {
              id: item.id,
              kodeIzin: item.kodeIzin,
              santriNama: item.santri.nama,
              santriNis: item.santri.nis,
              kelas: item.santri.kelas,
              jenis: item.jenis as "PULANG" | "KELUAR_KOMPLEK" | "SAKIT",
              durasi: `${diffDays} Hari`,
              alasan: item.alasan,
              status: item.status as "MENUNGGU_MK" | "MENUNGGU_KS" | "DISETUJUI" | "DITOLAK",
              diverifikasiOleh: item.disetujuiKS
                ? `Disetujui KS: ${item.disetujuiKS.nama}`
                : item.disetujuiMK
                ? `Diverifikasi MK: ${item.disetujuiMK.nama}`
                : undefined,
            };
          })
        );
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Dialog Form Tambah Izin
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedSantriNis, setSelectedSantriNis] = useState(santriList[0]?.nis || "");
  const [jenisIzin, setJenisIzin] = useState<"PULANG" | "KELUAR_KOMPLEK" | "SAKIT">("PULANG");
  const [durasiHari, setDurasiHari] = useState("2");
  const [alasanIzin, setAlasanIzin] = useState("");

  // Dialog Detail / Verifikasi Izin
  const [selectedDetailIzin, setSelectedDetailIzin] = useState<IzinItem | null>(null);
  const [catatanVerifikasi, setCatatanVerifikasi] = useState("");

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
    title: "Kirim Notifikasi Izin via WhatsApp",
    description: "Informasikan status perizinan santri secara santun kepada wali.",
  });

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filteredList = list.filter((item) => {
    const matchSearch =
      item.santriNama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kodeIzin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.alasan.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "ALL" || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Handler Submit Pengajuan Izin
  const handleAjukanIzin = () => {
    setFeedback(null);
    const targetSantri = santriList.find((s) => s.nis === selectedSantriNis);
    if (!targetSantri) {
      setFeedback({ type: "error", message: "Silakan pilih santri terlebih dahulu." });
      return;
    }
    if (!alasanIzin.trim()) {
      setFeedback({ type: "error", message: "Alasan perizinan wajib diisi secara jelas." });
      return;
    }

    startTransition(async () => {
      const today = new Date();
      const returnDate = new Date();
      returnDate.setDate(today.getDate() + (parseInt(durasiHari) || 1));

      const res = await ajukanIzinAction({
        santriId: targetSantri.id,
        jenis: jenisIzin,
        tanggalMulai: today.toISOString(),
        tanggalSelesai: returnDate.toISOString(),
        alasan: alasanIzin,
      });

      if (res.success && res.data) {
        const newIzin: IzinItem = {
          id: res.data.id,
          kodeIzin: res.data.kodeIzin,
          santriNama: targetSantri.nama,
          santriNis: targetSantri.nis,
          kelas: targetSantri.kelas,
          jenis: jenisIzin,
          durasi: `${durasiHari} Hari`,
          alasan: alasanIzin,
          status: "MENUNGGU_MK",
          diverifikasiOleh: `Diajukan oleh ${currentUserName}`,
        };

        setList((prev) => [newIzin, ...prev]);
        setShowAddDialog(false);
        setAlasanIzin("");
        setFeedback({
          type: "success",
          message: `Permohonan izin untuk ${targetSantri.nama} (${res.data.kodeIzin}) berhasil diajukan dan masuk ke antrean verifikasi MK.`,
        });

        // WhatsApp notification ready
        const msg = buildIzinSantriWAMessage({
          santriNama: targetSantri.nama,
          santriNis: targetSantri.nis,
          kelas: targetSantri.kelas,
          kodeIzin: res.data.kodeIzin,
          jenisIzin,
          durasi: `${durasiHari} Hari`,
          alasan: alasanIzin,
          status: "MENUNGGU_MK",
          diverifikasiOleh: currentUserName,
          batasKembali: returnDate.toLocaleDateString("id-ID"),
        });

        if (targetSantri.noHpWali) {
          setWaDialog({
            isOpen: true,
            phone: targetSantri.noHpWali,
            recipientName: targetSantri.namaWali ? `${targetSantri.namaWali} (Wali ${targetSantri.nama})` : `Wali dari ${targetSantri.nama}`,
            message: msg,
            title: "Notifikasi Pengajuan Izin ke Wali",
            description: "Kirim konfirmasi bahwa pengajuan izin telah dicatat di sistem.",
          });
        } else {
          setFeedback({
            type: "success",
            message: "Izin berhasil diajukan. Nomor WhatsApp wali belum tersedia.",
          });
        }

        if (onIzinUpdated) onIzinUpdated();
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal mengajukan izin." });
      }
    });
  };

  // Handler Verifikasi Izin (Approve / Reject)
  const handleVerifikasiIzin = (action: "APPROVE" | "REJECT" | "ESCALATE_KS") => {
    if (!selectedDetailIzin) return;

    startTransition(async () => {
      const res = await verifikasiIzinAction({
        izinId: selectedDetailIzin.id,
        action,
        catatan: catatanVerifikasi,
      });

      if (res.success) {
        const newStatus =
          action === "REJECT"
            ? "DITOLAK"
            : action === "ESCALATE_KS" || (selectedDetailIzin.jenis === "PULANG" && userRole !== "KS")
            ? "MENUNGGU_KS"
            : "DISETUJUI";

        setList((prev) =>
          prev.map((iz) =>
            iz.id === selectedDetailIzin.id
              ? {
                  ...iz,
                  status: newStatus,
                  diverifikasiOleh: `${action === "APPROVE" ? "Disetujui" : action === "REJECT" ? "Ditolak" : "Diteruskan ke KS"} oleh ${currentUserName}`,
                }
              : iz
          )
        );

        setSelectedDetailIzin(null);
        setCatatanVerifikasi("");
        setFeedback({
          type: "success",
          message: `Status izin ${selectedDetailIzin.kodeIzin} berhasil diperbarui: ${newStatus}.`,
        });

        if (onIzinUpdated) onIzinUpdated();
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal memperbarui izin." });
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Operasional & Tombol Tindakan Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
            <Send className="h-5 w-5 text-sky-600" />
            Manajemen Perizinan Santri
          </h2>
          <p className="text-xs text-slate-500">
            Daftar pengajuan izin pulang, izin keluar komplek, dan perizinan sakit santri
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setShowAddDialog(true)}
          className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-xs sm:text-sm gap-2 min-h-[44px] shadow-xs shrink-0"
        >
          <PlusCircle className="h-4 w-4" />
          + Ajukan Izin Baru
        </Button>
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

      {/* 2. Toolbar Pencarian & Filter Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama santri, kode izin, atau alasan..."
            className="pl-9 min-h-[42px] text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "ALL", label: "Semua Status" },
            { id: "MENUNGGU_MK", label: "Menunggu MK" },
            { id: "MENUNGGU_KS", label: "Menunggu KS" },
            { id: "DISETUJUI", label: "Disetujui" },
            { id: "DITOLAK", label: "Ditolak" },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 min-h-[36px] ${
                statusFilter === pill.id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Daftar Operasional Perizinan */}
      <Card rounded="3xl" className="border border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {filteredList.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedDetailIzin(item)}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {item.kodeIzin}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {item.santriNama}
                      </h4>
                      <Badge variant="sky" size="sm">
                        {item.kelas}
                      </Badge>
                      <Badge
                        variant={
                          item.jenis === "PULANG"
                            ? "orange"
                            : item.jenis === "SAKIT"
                            ? "purple"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {item.jenis}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-1">
                      <strong>Alasan:</strong> {item.alasan}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Durasi: {item.durasi} • {item.diverifikasiOleh || "Menunggu verifikasi"}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <Badge
                      variant={
                        item.status === "DISETUJUI"
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
                    <span className="text-[11px] text-[#0E7C3A] font-bold hover:underline">
                      Lihat Rincian &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              Tidak ada data perizinan yang sesuai dengan filter.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. DIALOG FORM TAMBAH IZIN BARU (Point 5) */}
      {showAddDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-izin-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 id="modal-izin-title" className="text-base font-bold text-slate-900 font-heading">
                  Ajukan Izin Santri Baru
                </h3>
                <p className="text-xs text-slate-500">
                  Formulir perizinan resmi terhubung ke database &amp; verifikasi asrama
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

            <div className="space-y-4">
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
                      {s.nama} ({s.nis} - {s.kelas})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Jenis Izin
                  </label>
                  <select
                    value={jenisIzin}
                    onChange={(e) =>
                      setJenisIzin(e.target.value as "PULANG" | "KELUAR_KOMPLEK" | "SAKIT")
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"
                  >
                    <option value="PULANG">Izin Pulang (Perlu KS)</option>
                    <option value="KELUAR_KOMPLEK">Keluar Komplek (MK)</option>
                    <option value="SAKIT">Sakit di UKS / Rujuk</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Durasi (Hari)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={14}
                    value={durasiHari}
                    onChange={(e) => setDurasiHari(e.target.value)}
                    className="min-h-[44px] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Alasan Lengkap &amp; Tujuan
                </label>
                <textarea
                  rows={3}
                  value={alasanIzin}
                  onChange={(e) => setAlasanIzin(e.target.value)}
                  placeholder="Contoh: Menghadiri acara pernikahan saudara kandung di Makassar..."
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
                  onClick={handleAjukanIzin}
                  disabled={isPending}
                  className="min-h-[42px] text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E]"
                >
                  {isPending ? "Mengajukan..." : "Kirim Permohonan Izin"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. DIALOG DETAIL & VERIFIKASI IZIN (Point 5) */}
      {selectedDetailIzin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-detail-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 id="modal-detail-title" className="text-base font-bold text-slate-900 font-heading">
                  Rincian Perizinan Santri
                </h3>
                <p className="text-xs text-slate-500">
                  Kode Berkas: <strong>{selectedDetailIzin.kodeIzin}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailIzin(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="p-3.5 bg-slate-50 rounded-2xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Santri:</span>
                  <strong className="text-slate-900">{selectedDetailIzin.santriNama}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kelas:</span>
                  <span className="font-semibold">{selectedDetailIzin.kelas}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jenis Izin:</span>
                  <Badge variant="sky" size="sm">{selectedDetailIzin.jenis}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Durasi:</span>
                  <span className="font-semibold">{selectedDetailIzin.durasi}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500">Status Saat Ini:</span>
                  <Badge variant={selectedDetailIzin.status === "DISETUJUI" ? "green" : "orange"} size="sm">
                    {selectedDetailIzin.status}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Alasan Permohonan:
                </label>
                <p className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
                  {selectedDetailIzin.alasan}
                </p>
              </div>

              {/* Kontrol Persetujuan Khusus MK & KS */}
              {["MK", "KS"].includes(userRole) && selectedDetailIzin.status.startsWith("MENUNGGU") && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 block">
                    Catatan Pembina / Mudir:
                  </label>
                  <Input
                    value={catatanVerifikasi}
                    onChange={(e) => setCatatanVerifikasi(e.target.value)}
                    placeholder="Catatan verifikasi (opsional)..."
                    className="min-h-[40px] text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="secondary"
                      onClick={() => handleVerifikasiIzin("REJECT")}
                      disabled={isPending}
                      className="border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold min-h-[40px]"
                    >
                      Tolak Izin
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleVerifikasiIzin("APPROVE")}
                      disabled={isPending}
                      className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white text-xs font-bold min-h-[40px]"
                    >
                      Setujui Izin
                    </Button>
                  </div>
                </div>
              )}
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
