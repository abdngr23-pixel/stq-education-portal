"use client";

import React, { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users,
  UserPlus,
  ArrowRightLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  UserCheck,
} from "lucide-react";
import {
  createHalaqohAction,
  assignPembinaHalaqohAction,
  pindahkanSantriHalaqohAction,
} from "@/app/actions/halaqoh";

export interface ManajemenHalaqohProps {
  halaqohList: Array<{
    id: string;
    halaqohCode: string;
    nama: string;
    pembina?: { id: string; nama: string; staffCode?: string } | null;
    tahunAjaran: string;
    _count?: { santriList: number };
    santriList?: Array<{ id: string; nis: string; nama: string; kelas: string }>;
  }>;
  staffMusyrifList?: Array<{ id: string; nama: string; staffCode: string }>;
  santriList?: Array<{ id: string; nis: string; nama: string; halaqohId?: string | null }>;
  onRefresh?: () => void;
}

export function ManajemenHalaqoh({
  halaqohList,
  staffMusyrifList = [],
  santriList = [],
  onRefresh,
}: ManajemenHalaqohProps) {
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal State: Buat Halaqoh
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [newPembinaId, setNewPembinaId] = useState("");
  const [newTahunAjaran, setNewTahunAjaran] = useState("2026/2027");

  // Modal State: Ganti Pembina
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedHalaqohForAssign, setSelectedHalaqohForAssign] = useState<any>(null);
  const [assignStaffId, setAssignStaffId] = useState("");

  // Modal State: Pindahkan Santri
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveSantriId, setMoveSantriId] = useState(santriList[0]?.id || "");
  const [targetHalaqohId, setTargetHalaqohId] = useState(halaqohList[0]?.id || "");

  const handleCreateHalaqoh = () => {
    if (!newNama.trim()) {
      setNotification({ type: "error", message: "Nama halaqoh wajib diisi." });
      return;
    }

    startTransition(async () => {
      const res = await createHalaqohAction({
        nama: newNama,
        pembinaId: newPembinaId || undefined,
        tahunAjaran: newTahunAjaran,
      });

      if (res.success) {
        setNotification({ type: "success", message: res.message });
        setShowCreateModal(false);
        setNewNama("");
        if (onRefresh) onRefresh();
      } else {
        setNotification({ type: "error", message: res.message });
      }
    });
  };

  const handleAssignPembina = () => {
    if (!selectedHalaqohForAssign || !assignStaffId) return;

    startTransition(async () => {
      const res = await assignPembinaHalaqohAction(selectedHalaqohForAssign.id, assignStaffId);

      if (res.success) {
        setNotification({ type: "success", message: res.message });
        setShowAssignModal(false);
        if (onRefresh) onRefresh();
      } else {
        setNotification({ type: "error", message: res.message });
      }
    });
  };

  const handleMoveSantri = () => {
    if (!moveSantriId || !targetHalaqohId) return;

    startTransition(async () => {
      const res = await pindahkanSantriHalaqohAction(moveSantriId, targetHalaqohId);

      if (res.success) {
        setNotification({ type: "success", message: res.message });
        setShowMoveModal(false);
        if (onRefresh) onRefresh();
      } else {
        setNotification({ type: "error", message: res.message });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Kontrol */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#0E7C3A]" />
            Manajemen &amp; Penugasan Halaqoh (Otoritas KS &amp; ADM)
          </h3>
          <p className="text-xs text-slate-500">
            Kelola kelompok halaqoh, penugasan musyrif pembina, dan perpindahan santri
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowMoveModal(true)}
            leftIcon={<ArrowRightLeft className="h-4 w-4 text-emerald-700" />}
            className="text-xs font-semibold"
          >
            Pindahkan Santri
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<PlusCircle className="h-4 w-4" />}
            className="text-xs font-semibold bg-[#0E7C3A] hover:bg-[#0B642E]"
          >
            Buat Halaqoh Baru
          </Button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <span className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600" />
            )}
            {notification.message}
          </span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Grid Kartu Halaqoh */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {halaqohList.map((h) => (
          <Card key={h.id} rounded="3xl" className="border border-slate-200 shadow-xs hover:border-[#0E7C3A]/40 transition-colors">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <Badge variant="green" size="sm">
                  {h.halaqohCode}
                </Badge>
                <span className="text-[11px] font-semibold text-slate-500">
                  TA: {h.tahunAjaran}
                </span>
              </div>
              <CardTitle className="text-base font-bold text-slate-900 mt-2">
                {h.nama}
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Pembina: <strong className="text-slate-900">{h.pembina?.nama || "Belum Ditugaskan"}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-600 bg-slate-50 p-2.5 rounded-2xl">
                <span>Santri Terdaftar:</span>
                <span className="font-bold text-slate-900">
                  {h._count?.santriList ?? (h.santriList ? h.santriList.length : 0)} Santri
                </span>
              </div>

              <div className="pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setSelectedHalaqohForAssign(h);
                    setAssignStaffId(h.pembina?.id || "");
                    setShowAssignModal(true);
                  }}
                  leftIcon={<UserCheck className="h-3.5 w-3.5 text-[#0E7C3A]" />}
                  className="text-xs h-8"
                >
                  Ganti / Tugaskan Pembina
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MODAL BUAT HALAQOH */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Buat Kelompok Halaqoh Baru
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <Input
                label="Nama Halaqoh"
                value={newNama}
                onChange={(e) => setNewNama(e.target.value)}
                placeholder="e.g. Halaqoh Abu Bakar Ash-Shiddiq"
              />

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Musyrif Pembina
                </label>
                <select
                  value={newPembinaId}
                  onChange={(e) => setNewPembinaId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  <option value="">-- Pilih Musyrif Pembina --</option>
                  {staffMusyrifList.map((stf) => (
                    <option key={stf.id} value={stf.id}>
                      {stf.nama} ({stf.staffCode})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Tahun Ajaran"
                value={newTahunAjaran}
                onChange={(e) => setNewTahunAjaran(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateHalaqoh}
                isLoading={isPending}
                className="bg-[#0E7C3A] hover:bg-[#0B642E]"
              >
                Simpan Halaqoh
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GANTI PEMBINA */}
      {showAssignModal && selectedHalaqohForAssign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  Tugaskan Pembina Halaqoh
                </h3>
                <p className="text-xs text-slate-500">{selectedHalaqohForAssign.nama}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Staf Musyrif Pembina
                </label>
                <select
                  value={assignStaffId}
                  onChange={(e) => setAssignStaffId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  <option value="">-- Pilih Staf Pembina --</option>
                  {staffMusyrifList.map((stf) => (
                    <option key={stf.id} value={stf.id}>
                      {stf.nama} ({stf.staffCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setShowAssignModal(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAssignPembina}
                isLoading={isPending}
                className="bg-[#0E7C3A] hover:bg-[#0B642E]"
              >
                Tetapkan Pembina
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PINDAHKAN SANTRI */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Pindahkan Santri ke Halaqoh Lain
              </h3>
              <button onClick={() => setShowMoveModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Santri
                </label>
                <select
                  value={moveSantriId}
                  onChange={(e) => setMoveSantriId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  {santriList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.nis})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Halaqoh Tujuan
                </label>
                <select
                  value={targetHalaqohId}
                  onChange={(e) => setTargetHalaqohId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
                >
                  {halaqohList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nama} ({h.pembina?.nama || "Tanpa Pembina"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setShowMoveModal(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleMoveSantri}
                isLoading={isPending}
                className="bg-[#0E7C3A] hover:bg-[#0B642E]"
              >
                Pindahkan Santri
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
