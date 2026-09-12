"use client";

import React, { useState, useTransition, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import {
  Users,
  Search,
  PlusCircle,
  Download,
  GraduationCap,
  BookCheck,
  Building2,
  Printer,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  SlidersHorizontal,
} from "lucide-react";
import { createSantriAction, updateBaselineModalSantriAction } from "@/app/actions/santri";
import { exportToCSV } from "@/lib/export-csv";
import { openWhatsAppDirect } from "@/lib/whatsapp";

export interface SantriItem {
  id: string;
  nis: string;
  nama: string;
  kelas: string;
  halaqoh: string;
  capaianJuz: number;
  targetJuz: number;
  setoranTerakhir: string;
  status: string;
  nilaiTerakhir: string;
  poinPelanggaran: number;
  namaWali?: string | null;
  noHpWali?: string | null;
  modalHalamanAwal?: number;
  modalHafalanAwalHalaman?: number;
  tanggalBaselineTahfizh?: string | null;
  tambahanSabaq?: number;
  totalHafalan?: number;
  totalHalaman?: number;
  posisiTerakhirHalaman?: number;
}

export interface MasterDataSantriProps {
  santriList: SantriItem[];
  userRole?: string;
  halaqohList?: Array<{ id: string; nama: string; pembina?: { nama: string } }>;
  onPrintRapor?: (santri: SantriItem) => void;
  onRefresh?: () => void;
}

export function MasterDataSantri({
  santriList,
  userRole = "ADM",
  halaqohList = [],
  onPrintRapor,
  onRefresh,
}: MasterDataSantriProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHalaqohFilter, setSelectedHalaqohFilter] = useState("ALL");
  const [selectedKelasFilter, setSelectedKelasFilter] = useState("ALL");
  const [selectedGenderFilter, setSelectedGenderFilter] = useState("ALL");

  // Modal State: Tambah Santri
  const [showAddModal, setShowAddModal] = useState(false);
  const [formNis, setFormNis] = useState("");
  const [formNama, setFormNama] = useState("");
  const [formKelas, setFormKelas] = useState("7A");
  const [formGender, setFormGender] = useState<"L" | "P">("L");
  const [formHalaqohId, setFormHalaqohId] = useState(halaqohList[0]?.id || "");
  const [formNamaWali, setFormNamaWali] = useState("");
  const [formNoHpWali, setFormNoHpWali] = useState("");

  // Modal State: Detail Santri
  const [selectedSantriDetail, setSelectedSantriDetail] = useState<SantriItem | null>(null);

  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal State: Kelola Baseline Modal Hafalan Santri (KS & ADM - Poin 4)
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const [selectedBaselineSantri, setSelectedBaselineSantri] = useState<SantriItem | null>(null);
  const [inputBaselineHalaman, setInputBaselineHalaman] = useState<string>("0");
  const [inputBaselineTanggal, setInputBaselineTanggal] = useState<string>("2026-09-08");
  const [inputBaselineAlasan, setInputBaselineAlasan] = useState<string>("");

  const handleOpenBaselineModal = (santri: SantriItem) => {
    setSelectedBaselineSantri(santri);
    const curModal = santri.modalHafalanAwalHalaman ?? santri.modalHalamanAwal ?? 0;
    setInputBaselineHalaman(String(curModal));
    setInputBaselineTanggal(
      santri.tanggalBaselineTahfizh
        ? santri.tanggalBaselineTahfizh.substring(0, 10)
        : "2026-09-08"
    );
    setInputBaselineAlasan("");
    setShowBaselineModal(true);
  };

  const handleSaveBaseline = () => {
    if (!selectedBaselineSantri) return;
    const hlmNum = parseFloat(inputBaselineHalaman);
    if (isNaN(hlmNum) || hlmNum < 0) {
      setNotification({ type: "error", message: "Modal hafalan awal harus berupa angka positif atau nol." });
      return;
    }
    if (!inputBaselineAlasan.trim() || inputBaselineAlasan.trim().length < 5) {
      setNotification({
        type: "error",
        message: "Alasan penetapan/perubahan baseline wajib diisi (minimal 5 karakter) untuk pencatatan audit log.",
      });
      return;
    }

    startTransition(async () => {
      const res = await updateBaselineModalSantriAction({
        santriId: selectedBaselineSantri.id,
        modalHafalanAwalHalaman: hlmNum,
        tanggalBaselineTahfizh: inputBaselineTanggal || "2026-09-08",
        alasan: inputBaselineAlasan.trim(),
      });

      if (res.success) {
        setNotification({ type: "success", message: res.message });
        setShowBaselineModal(false);
        if (onRefresh) onRefresh();
      } else {
        setNotification({ type: "error", message: res.message });
      }
    });
  };

  // Filter santri
  const filteredSantri = useMemo(() => {
    return santriList.filter((s) => {
      const matchSearch =
        s.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nis.toLowerCase().includes(searchTerm.toLowerCase());

      const matchHalaqoh =
        selectedHalaqohFilter === "ALL" || s.halaqoh.includes(selectedHalaqohFilter);

      const matchKelas =
        selectedKelasFilter === "ALL" || s.kelas.includes(selectedKelasFilter);

      const isPutri = s.kelas.includes("Putri") || s.halaqoh.includes("Lisa Dwina");
      const matchGender =
        selectedGenderFilter === "ALL" ||
        (selectedGenderFilter === "L" && !isPutri) ||
        (selectedGenderFilter === "P" && isPutri);

      return matchSearch && matchHalaqoh && matchKelas && matchGender;
    });
  }, [santriList, searchTerm, selectedHalaqohFilter, selectedKelasFilter, selectedGenderFilter]);

  // Statistik ringkasan
  const totalPutri = useMemo(() => {
    return santriList.filter(
      (s) => s.kelas.includes("Putri") || s.halaqoh.includes("Lisa Dwina")
    ).length;
  }, [santriList]);

  const totalPutra = santriList.length - totalPutri;

  // Handler Tambah Santri Baru
  const handleCreateSantri = () => {
    if (!formNis.trim() || !formNama.trim()) {
      setNotification({ type: "error", message: "NIS dan Nama Santri wajib diisi." });
      return;
    }

    startTransition(async () => {
      const res = await createSantriAction({
        nis: formNis,
        nama: formNama,
        kelas: formKelas,
        jenisKelamin: formGender,
        namaWali: formNamaWali || undefined,
        noHpWali: formNoHpWali || undefined,
        halaqohId: formHalaqohId || undefined,
      });

      if (res.success) {
        setNotification({ type: "success", message: res.message });
        setShowAddModal(false);
        setFormNis("");
        setFormNama("");
        setFormNamaWali("");
        setFormNoHpWali("");
        if (onRefresh) onRefresh();
      } else {
        setNotification({ type: "error", message: res.message });
      }
    });
  };

  // Handler Ekspor CSV
  const handleExportCSV = () => {
    const headers = [
      "No",
      "NIS",
      "Nama Santri",
      "Jenis Kelamin",
      "Kelas",
      "Kelompok Halaqoh",
      "Capaian Tahfizh (Juz)",
      "Target (Juz)",
      "Setoran Terakhir",
      "Status",
    ];

    const rows = filteredSantri.map((s, idx) => {
      const isPutri = s.kelas.includes("Putri") || s.halaqoh.includes("Lisa Dwina");
      return [
        idx + 1,
        s.nis,
        s.nama,
        isPutri ? "Putri (P)" : "Putra (L)",
        s.kelas,
        s.halaqoh,
        s.capaianJuz,
        s.targetJuz,
        s.setoranTerakhir,
        s.status,
      ];
    });

    exportToCSV("DATA_SANTRI_STQ_DARUL_ULUM_CENDEKIA", headers, rows);
  };

  const isCanManage = ["ADM", "KS"].includes(userRole);

  return (
    <div className="space-y-6">
      {/* Banner Notifikasi */}
      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs sm:text-sm font-semibold animate-fade-in ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-rose-50 text-rose-900 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Header Halaman & Aksi Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 text-[#0E7C3A]">
              <Users className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 font-heading">
              Master Data Santri
            </h2>
            <Badge variant="green" size="sm">
              57 Santri Aktif
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pangkalan data santri lengkap, penempatan kelompok halaqoh, kelas takhossus, dan progres capaian tahfizh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="h-4 w-4" />}
            className="text-xs font-semibold"
          >
            Ekspor CSV / Excel
          </Button>
          {isCanManage && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const obama = santriList.find((s) => s.nis === "SAN-0001") || santriList[0];
                if (obama) handleOpenBaselineModal(obama);
              }}
              leftIcon={<SlidersHorizontal className="h-4 w-4 text-emerald-700" />}
              className="text-xs font-semibold border-emerald-300 text-emerald-900 hover:bg-emerald-50"
            >
              Atur Baseline Modal
            </Button>
          )}
          {isCanManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
              leftIcon={<PlusCircle className="h-4 w-4" />}
              className="text-xs font-semibold bg-[#0E7C3A] hover:bg-[#0B642E]"
            >
              + Tambah Santri
            </Button>
          )}
        </div>
      </div>

      {/* 4 Kartu Metrik Ringkasan Santri */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Santri"
          value={`${santriList.length} Santri`}
          description="Terdaftar Aktif 2026/2027"
          icon={<Users className="h-5 w-5" />}
          badgeText="100% Aktif"
          badgeVariant="green"
        />
        <StatCard
          title="Santri Putra (Ikhwan)"
          value={`${totalPutra} Santri`}
          description="5 Kelompok Halaqoh"
          icon={<GraduationCap className="h-5 w-5" />}
          badgeText="Asrama Putra"
          badgeVariant="green"
        />
        <StatCard
          title="Santriwati Putri (Akhwat)"
          value={`${totalPutri} Santriwati`}
          description="Halaqoh Ustzh. Lisa Dwina"
          icon={<Building2 className="h-5 w-5" />}
          badgeText="Asrama Putri"
          badgeVariant="gold"
        />
        <StatCard
          title="Kelompok Halaqoh"
          value="6 Halaqoh"
          description="1 MT, 1 Putri, 4 Mudhabbir"
          icon={<BookCheck className="h-5 w-5" />}
          badgeText="Terdistribusi"
          badgeVariant="sky"
        />
      </div>

      {/* Toolbar Filter & Pencarian */}
      <Card rounded="3xl">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Input Pencarian Nama / NIS */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama santri atau NIS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A] transition-all"
              />
            </div>

            {/* Filter Halaqoh */}
            <div>
              <select
                value={selectedHalaqohFilter}
                onChange={(e) => setSelectedHalaqohFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
              >
                <option value="ALL">Semua Halaqoh (6 Kelompok)</option>
                <option value="Razan Mufli">Halaqoh Ust. Razan Mufli, S.Pd</option>
                <option value="Kamal">Halaqoh Ust. Kamal</option>
                <option value="Rizaldi">Halaqoh Ust. Rizaldi</option>
                <option value="Abi Hudzaifah">Halaqoh Ust. Abi Hudzaifah</option>
                <option value="Alwan">Halaqoh Ust. Alwan</option>
                <option value="Lisa Dwina">Halaqoh Ustadzah Lisa Dwina Fitri</option>
              </select>
            </div>

            {/* Filter Kelas */}
            <div>
              <select
                value={selectedKelasFilter}
                onChange={(e) => setSelectedKelasFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
              >
                <option value="ALL">Semua Tingkat Kelas</option>
                <option value="7A">Kelas 7A Takhossus</option>
                <option value="7B">Kelas 7B Takhossus</option>
                <option value="7C">Kelas 7C Putri</option>
                <option value="8A">Kelas 8A Takhossus</option>
                <option value="8B">Kelas 8B Takhossus</option>
                <option value="8C">Kelas 8C Putri</option>
                <option value="9A">Kelas 9A Takhossus</option>
                <option value="9C">Kelas 9C Putri</option>
              </select>
            </div>

            {/* Filter Gender */}
            <div>
              <select
                value={selectedGenderFilter}
                onChange={(e) => setSelectedGenderFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
              >
                <option value="ALL">Semua Gender (Putra &amp; Putri)</option>
                <option value="L">Ikhwan (Putra)</option>
                <option value="P">Akhwat (Putri)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              Menampilkan <strong>{filteredSantri.length}</strong> dari total{" "}
              <strong>{santriList.length}</strong> santri
            </span>
            {(searchTerm ||
              selectedHalaqohFilter !== "ALL" ||
              selectedKelasFilter !== "ALL" ||
              selectedGenderFilter !== "ALL") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedHalaqohFilter("ALL");
                  setSelectedKelasFilter("ALL");
                  setSelectedGenderFilter("ALL");
                }}
                className="text-xs text-[#0E7C3A] font-semibold hover:underline"
              >
                Reset Filter
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabel Master Data Santri */}
      <Card rounded="3xl" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 text-center w-12">No</th>
                <th className="py-3.5 px-4 w-28">NIS</th>
                <th className="py-3.5 px-4 min-w-[200px]">Nama Lengkap</th>
                <th className="py-3.5 px-3 text-center w-24">Gender</th>
                <th className="py-3.5 px-3 text-center w-28">Kelas</th>
                <th className="py-3.5 px-4 min-w-[180px]">Halaqoh &amp; Pembina</th>
                <th className="py-3.5 px-4 text-center min-w-[140px]">Capaian Tahfizh</th>
                <th className="py-3.5 px-4 min-w-[160px]">Setoran Terakhir</th>
                <th className="py-3.5 px-3 text-center w-24">Status</th>
                <th className="py-3.5 px-4 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredSantri.length > 0 ? (
                filteredSantri.map((santri, index) => {
                  const isPutri =
                    santri.kelas.includes("Putri") || santri.halaqoh.includes("Lisa Dwina");
                  return (
                    <tr
                      key={santri.id || santri.nis}
                      className="hover:bg-emerald-50/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-center text-slate-500 font-medium">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {santri.nis}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {santri.nama}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isPutri
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-sky-50 text-sky-700 border border-sky-200"
                          }`}
                        >
                          {isPutri ? "Akhwat (P)" : "Ikhwan (L)"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {santri.kelas}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-semibold">{santri.halaqoh}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-extrabold text-[#0E7C3A] text-sm">
                            {santri.totalHafalan ?? santri.totalHalaman ?? (santri.capaianJuz * 20)} Hlm
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Modal: {santri.modalHafalanAwalHalaman ?? santri.modalHalamanAwal ?? 0} | Sabaq: +{santri.tambahanSabaq ?? 0}
                          </span>
                          <span className="text-[9px] text-emerald-700 font-bold">
                            {santri.capaianJuz} Juz / 30 Juz
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        <div className="font-medium">{santri.setoranTerakhir || "-"}</div>
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          Nilai: {santri.nilaiTerakhir || "Belum ada data"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant="green" size="sm">
                          Aktif
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isCanManage && (
                            <button
                              type="button"
                              onClick={() => handleOpenBaselineModal(santri)}
                              title="Atur Baseline Modal Hafalan Santri"
                              aria-label={`Atur Baseline Modal Hafalan ${santri.nama}`}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-800 transition-colors"
                            >
                              <SlidersHorizontal className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedSantriDetail(santri)}
                            title="Lihat Detail Santri"
                            aria-label={`Lihat Detail Santri ${santri.nama}`}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {onPrintRapor && (
                            <button
                              type="button"
                              onClick={() => onPrintRapor(santri)}
                              title="Cetak Rapor Santri"
                              aria-label={`Cetak Rapor Santri ${santri.nama}`}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-[#0E7C3A] transition-colors"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold">Tidak ada santri yang sesuai kriteria pencarian.</p>
                    <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci atau reset filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL: DETAIL SANTRI */}
      {selectedSantriDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card rounded="3xl" className="max-w-md w-full p-6 bg-white space-y-4 shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-[#0E7C3A]">
                  <UserCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 font-heading">
                    Detail Data Pokok Santri
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    NIS: {selectedSantriDetail.nis}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSantriDetail(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Nama Lengkap</span>
                <p className="text-sm font-bold text-emerald-950">{selectedSantriDetail.nama}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Kelas</span>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedSantriDetail.kelas}</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Status</span>
                  <p className="font-bold text-emerald-700 mt-0.5">{selectedSantriDetail.status}</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Kelompok Halaqoh</span>
                <p className="font-bold text-slate-800">{selectedSantriDetail.halaqoh}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-emerald-800">Capaian Tahfizh</span>
                  <p className="font-extrabold text-[#0E7C3A] text-base mt-0.5">
                    {selectedSantriDetail.capaianJuz} Juz
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-100">
                  <span className="text-[10px] uppercase font-bold text-amber-800">Target Akhir Program</span>
                  <p className="font-extrabold text-amber-700 text-base mt-0.5">
                    30 Juz
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Orang Tua / Wali Santri</span>
                <p className="font-semibold text-slate-800">
                  {selectedSantriDetail.namaWali || `Wali dari ${selectedSantriDetail.nama}`}
                </p>
                <div className="flex items-center justify-between pt-0.5">
                  <p className="text-[11px] text-slate-500">
                    Kontak: {selectedSantriDetail.noHpWali || "Belum terdaftar"}
                  </p>
                  {selectedSantriDetail.noHpWali && (
                    <button
                      type="button"
                      onClick={() => {
                        const msg = `Assalamu'alaikum Warahmatullahi Wabarakatuh,\nYth. Orang Tua dari ananda *${selectedSantriDetail.nama}* (NIS: ${selectedSantriDetail.nis}, Kelas ${selectedSantriDetail.kelas}),\n\nKami dari Pengurus STQ Darul Ulum Cendekia ingin menyampaikan informasi terkait santri.\n\nSimak informasi & mutaba'ah santri melalui portal resmi:\nhttps://stq-education-portal-app-two.vercel.app\n\n_Jazakumullahu Khairan_\n*STQ Darul Ulum Cendekia*`;
                        openWhatsAppDirect(selectedSantriDetail.noHpWali, msg);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#128C7E] bg-[#25D366]/15 hover:bg-[#25D366]/25 px-2 py-1 rounded-xl transition-colors border border-[#25D366]/30"
                    >
                    <svg className="h-3 w-3 fill-current text-[#25D366]" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                    </svg>
                    <span>Hubungi via WA</span>
                  </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {onPrintRapor && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onPrintRapor(selectedSantriDetail);
                    setSelectedSantriDetail(null);
                  }}
                  leftIcon={<Printer className="h-4 w-4" />}
                >
                  Cetak Rapor
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedSantriDetail(null)}
                className="bg-[#0E7C3A] hover:bg-[#0B642E]"
              >
                Tutup
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: TAMBAH SANTRI BARU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <Card rounded="3xl" className="max-w-lg w-full p-6 bg-white space-y-4 shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-[#0E7C3A]">
                  <PlusCircle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 font-heading">
                    Pendaftaran Santri Baru
                  </h3>
                  <p className="text-xs text-slate-500">
                    Formulir penambahan data induk santri ke pangkalan data STQ DUC.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Nomor Induk Santri (NIS) *</label>
                  <Input
                    placeholder="Contoh: SAN-0058"
                    value={formNis}
                    onChange={(e) => setFormNis(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Jenis Kelamin *</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as "L" | "P")}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:bg-white"
                  >
                    <option value="L">Ikhwan (Laki-laki)</option>
                    <option value="P">Akhwat (Perempuan)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Nama Lengkap Santri *</label>
                <Input
                  placeholder="Nama lengkap santri sesuai akta lahir"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Tingkat Kelas *</label>
                  <select
                    value={formKelas}
                    onChange={(e) => setFormKelas(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:bg-white"
                  >
                    <option value="7A">7A (Takhossus Putra)</option>
                    <option value="7B">7B (Takhossus Putra)</option>
                    <option value="7C">7C (Takhossus Putri)</option>
                    <option value="8A">8A (Takhossus Putra)</option>
                    <option value="8B">8B (Takhossus Putra)</option>
                    <option value="8C">8C (Takhossus Putri)</option>
                    <option value="9A">9A (Takhossus Putra)</option>
                    <option value="9C">9C (Takhossus Putri)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Kelompok Halaqoh</label>
                  <select
                    value={formHalaqohId}
                    onChange={(e) => setFormHalaqohId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:bg-white"
                  >
                    {halaqohList.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Nama Orang Tua / Wali</label>
                  <Input
                    placeholder="Nama ayah / ibu / wali"
                    value={formNamaWali}
                    onChange={(e) => setFormNamaWali(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">No. WhatsApp Wali</label>
                  <Input
                    placeholder="0812xxxxxxxx"
                    value={formNoHpWali}
                    onChange={(e) => setFormNoHpWali(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddModal(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateSantri}
                disabled={isPending}
                className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold"
              >
                {isPending ? "Menyimpan..." : "Simpan Santri"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: KELOLA BASELINE MODAL HAFALAN AWAL (KS & ADM - POIN 4) */}
      {showBaselineModal && selectedBaselineSantri && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <Card rounded="3xl" className="max-w-lg w-full p-6 bg-white space-y-4 shadow-2xl animate-scale-in border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-50 text-[#0E7C3A]">
                  <SlidersHorizontal className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm font-heading">
                    Atur Baseline Modal Hafalan Awal
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Otoritas resmi KS &amp; ADM dengan pencatatan audit log permanen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBaselineModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Banner Khusus Santri Obama (Preview Data Lama - Poin 4) */}
            {selectedBaselineSantri.nis === "SAN-0001" && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <BookCheck className="h-4 w-4 text-amber-700" />
                  <span>Preview Data Historis (Aplikasi Lama): Obama</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Berdasarkan pangkalan data lama STQ Darul Ulum Cendekia, santri Obama memiliki modal hafalan awal tercatat <strong>420 halaman</strong> (21 Juz).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInputBaselineHalaman("420");
                    setInputBaselineTanggal("2026-09-08");
                    setInputBaselineAlasan("Penetapan modal awal hafalan historis pra-sistem digital 420 halaman (21 Juz)");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold text-[11px] transition-colors"
                >
                  ✓ Terapkan Data Historis: 420 Hlm (8 Sept 2026)
                </button>
              </div>
            )}

            {/* Info Santri Terpilih */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Santri:</span>
                <span className="font-bold text-slate-800">{selectedBaselineSantri.nama} ({selectedBaselineSantri.nis})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Halaqoh:</span>
                <span className="font-semibold text-slate-700">{selectedBaselineSantri.halaqoh}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Modal Saat Ini:</span>
                <span className="font-bold text-emerald-800">
                  {selectedBaselineSantri.modalHafalanAwalHalaman ?? selectedBaselineSantri.modalHalamanAwal ?? 0} Halaman
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Tambahan Sabaq:</span>
                <span className="font-semibold text-emerald-700">+{selectedBaselineSantri.tambahanSabaq ?? 0} Halaman</span>
              </div>
            </div>

            {/* Form Inputs */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Modal Hafalan Awal (Hlm) <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Contoh: 420"
                    value={inputBaselineHalaman}
                    onChange={(e) => setInputBaselineHalaman(e.target.value)}
                  />
                  <span className="text-[10px] text-slate-400">
                    {Math.floor((parseFloat(inputBaselineHalaman) || 0) / 20)} Juz {(parseFloat(inputBaselineHalaman) || 0) % 20} Hlm
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Tanggal Baseline <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={inputBaselineTanggal}
                    onChange={(e) => setInputBaselineTanggal(e.target.value)}
                  />
                  <span className="text-[10px] text-slate-400">
                    Sabaq setelah tanggal ini diakumulasi
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Alasan Penetapan / Perubahan <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={inputBaselineAlasan}
                  onChange={(e) => setInputBaselineAlasan(e.target.value)}
                  placeholder="Contoh: Verifikasi mutaba'ah fisik dan konversi hafalan aplikasi lama..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#0E7C3A]/20 focus:border-[#0E7C3A]"
                />
                <span className="text-[10px] text-slate-400">
                  Wajib diisi minimal 5 karakter untuk audit trail.
                </span>
              </div>

              {/* Live Preview Hasil */}
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-1">
                <div className="font-bold text-emerald-900 text-[11px] uppercase tracking-wider">
                  Hasil Kalkulasi Akumulasi Baru:
                </div>
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-slate-600">Total Hafalan Menjadi:</span>
                  <span className="font-extrabold text-emerald-950 text-sm">
                    {(parseFloat(inputBaselineHalaman) || 0) + (selectedBaselineSantri.tambahanSabaq ?? 0)} Halaman
                  </span>
                </div>
                <div className="text-[10px] text-emerald-700">
                  Rumus: Modal Awal ({parseFloat(inputBaselineHalaman) || 0} Hlm) + Sabaq Sah (+{selectedBaselineSantri.tambahanSabaq ?? 0} Hlm)
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBaselineModal(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveBaseline}
                disabled={isPending || !inputBaselineAlasan.trim() || inputBaselineAlasan.trim().length < 5}
                className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold"
              >
                {isPending ? "Menyimpan..." : "Simpan Baseline Modal"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
