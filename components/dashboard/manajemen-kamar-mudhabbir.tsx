"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BedDouble,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  ArrowRightLeft,
  Power,
  Users,
  Settings2,
  Lock,
} from "lucide-react";
import {
  getKamarListAction,
  createKamarAction,
  updateKamarAction,
  setKamarActiveAction,
  assignMudhabbirAction,
  assignSantriToKamarAction,
  transferSantriKamarAction,
  getAvailableMudhabbirListAction,
  getActiveSantriForPlacementAction,
} from "@/app/actions/kamar";
import { GenderComplex } from "@/types/architecture-lock";

export interface KamarItem {
  id: string;
  code: string;
  name: string;
  genderComplex: GenderComplex;
  isActive: boolean;
  assignments?: Array<{
    id: string;
    status: string;
    user: {
      id: string;
      name: string;
      username: string;
      staff?: { id: string; nama: string; staffCode?: string } | null;
    };
    scopedUnits?: Array<{
      unitId: string;
      unit?: { id: string; code: string; name: string };
    }>;
  }>;
  santriKamarPlacements?: Array<{
    id: string;
    isActive: boolean;
    santri: {
      id: string;
      nis: string;
      nama: string;
      jenisKelamin: string;
    };
  }>;
}

export interface MudhabbirCandidate {
  id: string;
  username: string;
  name?: string;
  staff?: {
    id: string;
    nama: string;
    staffCode?: string;
  } | null;
}

export interface SantriCandidate {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  jenisKelamin: string;
  kamarPlacements?: Array<{
    id: string;
    kamarId: string;
    kamar?: { id: string; code: string; name: string };
  }>;
}

export interface ManajemenKamarMudhabbirProps {
  initialKamarList?: KamarItem[];
  onRefresh?: () => void;
}

export function ManajemenKamarMudhabbir({
  initialKamarList = [],
  onRefresh,
}: ManajemenKamarMudhabbirProps) {
  const [isPending, startTransition] = useTransition();
  const [kamarList, setKamarList] = useState<KamarItem[]>(initialKamarList);
  const [mudhabbirList, setMudhabbirList] = useState<MudhabbirCandidate[]>([]);
  const [santriList, setSantriList] = useState<SantriCandidate[]>([]);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newNama, setNewNama] = useState("");
  const [newGender, setNewGender] = useState<GenderComplex>("PUTRA");
  const [newNotes, setNewNotes] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editKamar, setEditKamar] = useState<KamarItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState<GenderComplex>("PUTRA");
  const [editIsActive, setEditIsActive] = useState(true);

  const [showAssignMudhabbirModal, setShowAssignMudhabbirModal] = useState(false);
  const [targetKamarForMudhabbir, setTargetKamarForMudhabbir] = useState<KamarItem | null>(null);
  const [selectedMudhabbirUserId, setSelectedMudhabbirUserId] = useState("");
  const [additionalKamarIds, setAdditionalKamarIds] = useState<string[]>([]);

  const [showAssignSantriModal, setShowAssignSantriModal] = useState(false);
  const [targetKamarForSantri, setTargetKamarForSantri] = useState<KamarItem | null>(null);
  const [selectedSantriId, setSelectedSantriId] = useState("");

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSantriId, setTransferSantriId] = useState("");
  const [transferTargetKamarId, setTransferTargetKamarId] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  const refreshData = () => {
    startTransition(async () => {
      const resKamar = await getKamarListAction();
      if (resKamar.success && resKamar.data) {
        setKamarList(resKamar.data as KamarItem[]);
      }
      const resMudhabbir = await getAvailableMudhabbirListAction();
      if (resMudhabbir.success && resMudhabbir.data) {
        setMudhabbirList(resMudhabbir.data as MudhabbirCandidate[]);
      }
      const resSantri = await getActiveSantriForPlacementAction();
      if (resSantri.success && resSantri.data) {
        setSantriList(resSantri.data as SantriCandidate[]);
      }
      if (onRefresh) onRefresh();
    });
  };

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateKamar = () => {
    if (!newCode.trim() || !newNama.trim()) {
      setNotification({ type: "error", message: "Kode dan Nama Kamar wajib diisi." });
      return;
    }

    startTransition(async () => {
      const res = await createKamarAction({
        code: newCode.trim(),
        name: newNama.trim(),
        genderComplex: newGender,
        notes: newNotes.trim() || undefined,
      });

      if (res.success) {
        setNotification({ type: "success", message: res.message || "Kamar berhasil dibuat." });
        setShowCreateModal(false);
        setNewCode("");
        setNewNama("");
        setNewNotes("");
        refreshData();
      } else {
        setNotification({ type: "error", message: res.message || "Gagal membuat kamar." });
      }
    });
  };

  const handleUpdateKamar = () => {
    if (!editKamar) return;
    if (!editName.trim()) {
      setNotification({ type: "error", message: "Nama kamar wajib diisi." });
      return;
    }

    startTransition(async () => {
      const res = await updateKamarAction({
        kamarId: editKamar.id,
        name: editName.trim(),
        genderComplex: editGender,
        isActive: editIsActive,
      });

      if (res.success) {
        setNotification({ type: "success", message: res.message || "Kamar berhasil diperbarui." });
        setShowEditModal(false);
        setEditKamar(null);
        refreshData();
      } else {
        setNotification({ type: "error", message: res.message || "Gagal memperbarui kamar." });
      }
    });
  };

  const handleToggleActiveKamar = (kamar: KamarItem) => {
    const nextState = !kamar.isActive;
    const confirmMsg = nextState
      ? `Aktifkan kembali kamar ${kamar.name}?`
      : `Nonaktifkan (soft-disable) kamar ${kamar.name}?`;
    if (!window.confirm(confirmMsg)) return;

    startTransition(async () => {
      const res = await setKamarActiveAction({
        kamarId: kamar.id,
        isActive: nextState,
      });

      if (res.success) {
        setNotification({ type: "success", message: res.message || "Status kamar diperbarui." });
        refreshData();
      } else {
        setNotification({ type: "error", message: res.message || "Gagal mengubah status kamar." });
      }
    });
  };

  const handleAssignMudhabbir = () => {
    if (!targetKamarForMudhabbir || !selectedMudhabbirUserId) {
      setNotification({ type: "error", message: "Pilih kamar dan staf mudhabbir." });
      return;
    }

    startTransition(async () => {
      const res = await assignMudhabbirAction({
        kamarId: targetKamarForMudhabbir.id,
        mudhabbirUserId: selectedMudhabbirUserId,
        additionalKamarIds: additionalKamarIds.length > 0 ? additionalKamarIds : undefined,
      });

      if (res.success) {
        setNotification({ type: "success", message: res.message || "Mudhabbir berhasil ditetapkan." });
        setShowAssignMudhabbirModal(false);
        setTargetKamarForMudhabbir(null);
        setSelectedMudhabbirUserId("");
        setAdditionalKamarIds([]);
        refreshData();
      } else {
        setNotification({ type: "error", message: res.message || "Gagal menetapkan mudhabbir." });
      }
    });
  };

  const handleAssignSantri = () => {
    if (!targetKamarForSantri || !selectedSantriId) {
      setNotification({ type: "error", message: "Pilih santri untuk ditempatkan." });
      return;
    }

    startTransition(async () => {
      const res = await assignSantriToKamarAction({
        kamarId: targetKamarForSantri.id,
        santriIds: [selectedSantriId],
      });

      if (res.success) {
        setNotification({ type: "success", message: res.message || "Santri berhasil ditempatkan." });
        setShowAssignSantriModal(false);
        setTargetKamarForSantri(null);
        setSelectedSantriId("");
        refreshData();
      } else {
        setNotification({ type: "error", message: res.message || "Gagal menempatkan santri." });
      }
    });
  };

  const handleTransferSantri = () => {
    if (!transferSantriId || !transferTargetKamarId) {
      setNotification({ type: "error", message: "Pilih santri dan kamar tujuan." });
      return;
    }

    startTransition(async () => {
      const res = await transferSantriKamarAction({
        santriId: transferSantriId,
        targetKamarId: transferTargetKamarId,
        notes: transferNotes.trim() || undefined,
      });

      if (res.success) {
        setNotification({ type: "success", message: res.message || "Santri berhasil dipindahkan." });
        setShowTransferModal(false);
        setTransferSantriId("");
        setTransferTargetKamarId("");
        setTransferNotes("");
        refreshData();
      } else {
        setNotification({ type: "error", message: res.message || "Gagal memindahkan santri." });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Info & Canonical Guard Notice */}
      <Card className="border-l-4 border-l-[#0E7C3A] bg-gradient-to-r from-emerald-50/50 to-white">
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BedDouble className="h-5 w-5 text-[#0E7C3A]" />
                <h2 className="text-base font-bold text-slate-800">
                  Manajemen Keasramaan — Kamar &amp; Mudhabbir
                </h2>
                <Badge variant="green" className="text-2xs">
                  <ShieldCheck className="h-3 w-3 mr-1 inline" /> Otoritas Mudir Canonical
                </Badge>
              </div>
              <p className="text-xs text-slate-600">
                Pengaturan struktur kamar, penempatan santri aktif, dan penugasan Mudhabbir (PEMBINA_HALAQOH) berbasis kapabilitas kanonikal.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                disabled={isPending}
                leftIcon={<PlusCircle className="h-4 w-4" />}
                className="bg-[#0E7C3A] hover:bg-[#095C2B] text-white text-xs font-semibold"
              >
                Buat Kamar Baru
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTransferSantriId(santriList[0]?.id || "");
                  setTransferTargetKamarId(kamarList[0]?.id || "");
                  setShowTransferModal(true);
                }}
                disabled={isPending || kamarList.length === 0}
                leftIcon={<ArrowRightLeft className="h-4 w-4" />}
                className="text-xs font-semibold"
              >
                Transfer Santri
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security & Isolation Notice */}
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-2xs text-amber-900">
        <Lock className="h-4 w-4 text-amber-700 shrink-0" />
        <span>
          <strong>Invarian Keamanan:</strong> Fitur ini beroperasi melalui kapabilitas kanonikal <code>keasramaan.kamar.manage</code>. User Admin (WF-15) tetap <strong>TERKUNCI</strong>. Mudhabbir tidak diinferensi dari username atau nama; penugasan multi-kamar didukung via model relasi <code>ASSIGNED_UNITS</code>.
        </span>
      </div>

      {/* Notification Toast/Banner */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
            notification.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold px-2 py-0.5 rounded hover:bg-black/5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Kamar List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kamarList.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
            <BedDouble className="h-8 w-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-semibold">Belum ada unit kamar keasramaan terdaftar.</p>
            <p className="text-xs text-slate-400 mt-1">Klik tombol &quot;Buat Kamar Baru&quot; untuk menambahkan unit.</p>
          </div>
        ) : (
          kamarList.map((kamar) => {
            const activeAssignment = kamar.assignments?.find((a) => a.status === "ACTIVE");
            const mudhabbirUser = activeAssignment?.user;
            const scopedUnitsCount = activeAssignment?.scopedUnits?.length || 1;
            const occupants = kamar.santriKamarPlacements || [];

            return (
              <Card
                key={kamar.id}
                className={`transition-all border ${
                  !kamar.isActive
                    ? "opacity-60 bg-slate-50 border-slate-300"
                    : "hover:shadow-md bg-white border-slate-200"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold text-slate-800">
                          {kamar.name}
                        </CardTitle>
                        <Badge
                          variant={
                            kamar.genderComplex === "PUTRA"
                              ? "sky"
                              : kamar.genderComplex === "PUTRI"
                              ? "orange"
                              : "purple"
                          }
                          className="text-2xs"
                        >
                          {kamar.genderComplex}
                        </Badge>
                      </div>
                      <CardDescription className="text-2xs text-slate-500 mt-0.5">
                        Kode: {kamar.code}
                      </CardDescription>
                    </div>

                    <Badge
                      variant={kamar.isActive ? "green" : "neutral"}
                      className="text-2xs font-semibold"
                    >
                      {kamar.isActive ? "Aktif" : "Non-aktif"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Mudhabbir Section */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-2xs text-slate-500 font-semibold">
                      <span>Mudhabbir (Pembina):</span>
                      {scopedUnitsCount > 1 && (
                        <span className="text-indigo-600 font-bold">
                          Multi-Kamar ({scopedUnitsCount} unit)
                        </span>
                      )}
                    </div>
                    {mudhabbirUser ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {mudhabbirUser.staff?.nama || mudhabbirUser.username}
                          </p>
                          <p className="text-2xs text-slate-500">
                            @{mudhabbirUser.username} {mudhabbirUser.staff?.staffCode ? `• [${mudhabbirUser.staff.staffCode}]` : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTargetKamarForMudhabbir(kamar);
                            setSelectedMudhabbirUserId(mudhabbirUser.id);
                            setShowAssignMudhabbirModal(true);
                          }}
                          className="text-2xs text-[#0E7C3A] hover:bg-emerald-50"
                        >
                          Ganti
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-2xs text-slate-400 italic">Belum ada Mudhabbir</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTargetKamarForMudhabbir(kamar);
                            setSelectedMudhabbirUserId(mudhabbirList[0]?.id || "");
                            setShowAssignMudhabbirModal(true);
                          }}
                          className="text-2xs text-[#0E7C3A] font-bold hover:bg-emerald-50"
                        >
                          + Tetapkan
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Occupants Section */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-2xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-slate-500" />
                        Santri Penghuni ({occupants.length} anak):
                      </span>
                      <button
                        onClick={() => {
                          setTargetKamarForSantri(kamar);
                          setSelectedSantriId(santriList[0]?.id || "");
                          setShowAssignSantriModal(true);
                        }}
                        className="text-2xs text-[#0E7C3A] font-bold hover:underline"
                      >
                        + Tambah Santri
                      </button>
                    </div>

                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {occupants.length === 0 ? (
                        <p className="text-2xs text-slate-400 italic py-1">Kamar masih kosong.</p>
                      ) : (
                        occupants.map((occ) => (
                          <div
                            key={occ.id}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-100 text-2xs"
                          >
                            <span className="font-medium text-slate-700 truncate max-w-[140px]">
                              {occ.santri.nama}
                            </span>
                            <span className="text-slate-400 text-3xs">NIS: {occ.santri.nis}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditKamar(kamar);
                        setEditName(kamar.name);
                        setEditGender(kamar.genderComplex);
                        setEditIsActive(kamar.isActive);
                        setShowEditModal(true);
                      }}
                      leftIcon={<Settings2 className="h-3.5 w-3.5" />}
                      className="text-2xs text-slate-600 hover:text-slate-900"
                    >
                      Edit Kamar
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActiveKamar(kamar)}
                      leftIcon={<Power className="h-3.5 w-3.5" />}
                      className={`text-2xs font-semibold ${
                        kamar.isActive ? "text-amber-600 hover:text-amber-800" : "text-emerald-600 hover:text-emerald-800"
                      }`}
                    >
                      {kamar.isActive ? "Soft-Disable" : "Aktifkan"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal 1: Buat Kamar Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">Buat Unit Kamar Baru</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kode Kamar (Unik):
                </label>
                <Input
                  placeholder="Misal: OU-KAMAR-ABUBAKAR"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Kamar:
                </label>
                <Input
                  placeholder="Misal: Kamar Abu Bakar Ash-Shiddiq"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kompleks Gender:
                </label>
                <select
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value as GenderComplex)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0E7C3A]"
                >
                  <option value="PUTRA">PUTRA</option>
                  <option value="PUTRI">PUTRI</option>
                  <option value="CAMPUR">CAMPUR</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Catatan / Keterangan (Opsional):
                </label>
                <Input
                  placeholder="Kapasitas, lokasi gedung, dll."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateModal(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateKamar}
                disabled={isPending}
                className="bg-[#0E7C3A] hover:bg-[#095C2B] text-white text-xs font-semibold"
              >
                {isPending ? "Menyimpan..." : "Simpan Kamar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Kamar */}
      {showEditModal && editKamar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">Edit Kamar: {editKamar.code}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Kamar:
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kompleks Gender:
                </label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value as GenderComplex)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0E7C3A]"
                >
                  <option value="PUTRA">PUTRA</option>
                  <option value="PUTRI">PUTRI</option>
                  <option value="CAMPUR">CAMPUR</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="editIsActiveCheckbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-[#0E7C3A] focus:ring-[#0E7C3A]"
                />
                <label htmlFor="editIsActiveCheckbox" className="text-xs font-semibold text-slate-700">
                  Status Kamar Aktif
                </label>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditModal(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpdateKamar}
                disabled={isPending}
                className="bg-[#0E7C3A] hover:bg-[#095C2B] text-white text-xs font-semibold"
              >
                {isPending ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Tetapkan Mudhabbir (Multi-Kamar Support) */}
      {showAssignMudhabbirModal && targetKamarForMudhabbir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                Tetapkan Mudhabbir: {targetKamarForMudhabbir.name}
              </h3>
              <button
                onClick={() => setShowAssignMudhabbirModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Staf Personal (Akun PERSONAL &amp; Profil Staff Aktif):
                </label>
                <select
                  value={selectedMudhabbirUserId}
                  onChange={(e) => setSelectedMudhabbirUserId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0E7C3A]"
                >
                  <option value="">-- Pilih Staf Musyrif / Mudhabbir --</option>
                  {mudhabbirList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.staff?.nama || m.username} (@{m.username}) {m.staff?.staffCode ? `[${m.staff.staffCode}]` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-3xs text-slate-500 mt-1">
                  Mudhabbir akan diangkat pada posisi kanonikal <code>PEMBINA_HALAQOH</code>.
                </p>
              </div>

              {/* Multi-Kamar Scoping Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kamar Tambahan untuk Mudhabbir ini (Multi-Kamar Scoping):
                </label>
                <p className="text-2xs text-slate-500 mb-2">
                  Pilih kamar lain jika Mudhabbir ini bertugas membina lebih dari 1 kamar sekaligus.
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-slate-200 bg-slate-50">
                  {kamarList
                    .filter((k) => k.id !== targetKamarForMudhabbir.id)
                    .map((otherKamar) => {
                      const isChecked = additionalKamarIds.includes(otherKamar.id);
                      return (
                        <label
                          key={otherKamar.id}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAdditionalKamarIds([...additionalKamarIds, otherKamar.id]);
                              } else {
                                setAdditionalKamarIds(
                                  additionalKamarIds.filter((id) => id !== otherKamar.id)
                                );
                              }
                            }}
                            className="rounded border-slate-300 text-[#0E7C3A] focus:ring-[#0E7C3A]"
                          />
                          <span className="font-medium text-slate-700">{otherKamar.name}</span>
                          <span className="text-slate-400 text-3xs">({otherKamar.code})</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAssignMudhabbirModal(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAssignMudhabbir}
                disabled={isPending || !selectedMudhabbirUserId}
                className="bg-[#0E7C3A] hover:bg-[#095C2B] text-white text-xs font-semibold"
              >
                {isPending ? "Menetapkan..." : "Tetapkan Penugasan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Tambah Santri ke Kamar */}
      {showAssignSantriModal && targetKamarForSantri && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                Tempatkan Santri: {targetKamarForSantri.name}
              </h3>
              <button
                onClick={() => setShowAssignSantriModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Santri Aktif:
                </label>
                <select
                  value={selectedSantriId}
                  onChange={(e) => setSelectedSantriId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0E7C3A]"
                >
                  <option value="">-- Pilih Santri --</option>
                  {santriList.map((s) => {
                    const currentKamar = s.kamarPlacements?.[0]?.kamar?.name;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.nis}) {currentKamar ? `[Saat ini: ${currentKamar}]` : "[Belum ada kamar]"}
                      </option>
                    );
                  })}
                </select>
                <p className="text-3xs text-slate-500 mt-1">
                  Gender santri harus selaras dengan kompleks gender kamar ({targetKamarForSantri.genderComplex}).
                </p>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAssignSantriModal(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAssignSantri}
                disabled={isPending || !selectedSantriId}
                className="bg-[#0E7C3A] hover:bg-[#095C2B] text-white text-xs font-semibold"
              >
                {isPending ? "Menempatkan..." : "Tempatkan ke Kamar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Transfer Santri Antar Kamar (Preserves History) */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">Transfer Santri Antar Kamar</h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Santri yang Dipindahkan:
                </label>
                <select
                  value={transferSantriId}
                  onChange={(e) => setTransferSantriId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0E7C3A]"
                >
                  <option value="">-- Pilih Santri --</option>
                  {santriList.map((s) => {
                    const currentKamar = s.kamarPlacements?.[0]?.kamar?.name;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.nama} ({s.nis}) {currentKamar ? `[Saat ini: ${currentKamar}]` : "[Belum ada kamar]"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kamar Tujuan:
                </label>
                <select
                  value={transferTargetKamarId}
                  onChange={(e) => setTransferTargetKamarId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0E7C3A]"
                >
                  <option value="">-- Pilih Kamar Tujuan --</option>
                  {kamarList
                    .filter((k) => k.isActive)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} ({k.code} • {k.genderComplex})
                      </option>
                    ))}
                </select>
                <p className="text-3xs text-slate-500 mt-1">
                  Riwayat penempatan lama ditutup dengan tanggal akhir; riwayat tersimpan permanen.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Alasan / Keterangan Perpindahan:
                </label>
                <Input
                  placeholder="Misal: Penyesuaian jenjang atau mutasi asrama"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTransferModal(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleTransferSantri}
                disabled={isPending || !transferSantriId || !transferTargetKamarId}
                className="bg-[#0E7C3A] hover:bg-[#095C2B] text-white text-xs font-semibold"
              >
                {isPending ? "Memindahkan..." : "Proses Transfer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
