"use client";

import React, { useState, useTransition, useMemo } from "react";
import { Role } from "@/types/auth";
import { DashboardSantriSummary } from "./beranda-module";
import { RekapLaporanBulanan } from "@/components/dashboard/rekap-laporan-bulanan";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createSetoranAction } from "@/app/actions/tahfizh";
import {
  inputHasilTahap1Action,
  inputHasilTahap2Action,
  ajukanIkhtibarAction,
} from "@/app/actions/ikhtibar";
import { type LaporanBulananData } from "@/app/actions/laporan-bulanan";
import { WhatsAppDialog } from "@/components/ui/whatsapp-dialog";
import { buildSetoranTahfizhWAMessage } from "@/lib/whatsapp";
import {
  JUZ_LIST,
  getJuzByPage,
} from "@/lib/quran-metadata";
import {
  BookCheck,
  Award,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  X,
  PlusCircle,
  Calculator,
  Info,
} from "lucide-react";
import { konversiHalamanKeJuz, HALAMAN_PER_JUZ } from "@/lib/laporan-bulanan";

export interface TahfizhModuleProps {
  userRole: Role;
  currentUserName: string;
  currentHalaqohName?: string | null;
  santriList: DashboardSantriSummary[];
  halaqohList: Array<{ id: string; nama: string }>;
  initialOpenForm?: boolean;
  onPrintPreview?: (data: LaporanBulananData) => void;
}

export function TahfizhModule({
  userRole,
  currentUserName,
  currentHalaqohName,
  santriList,
  halaqohList,
  initialOpenForm = false,
  onPrintPreview,
}: TahfizhModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<"setoran" | "laporan" | "ikhtibar">(
    initialOpenForm ? "setoran" : "setoran"
  );

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // -------------------------------------------------------------
  // FORM INPUT SETORAN TUNGGAL BERBASIS HALAMAN & JUZ
  // -------------------------------------------------------------
  const [selectedSantriNis, setSelectedSantriNis] = useState<string>(
    santriList[0]?.nis || ""
  );
  const [inputJenis, setInputJenis] = useState<"SABAQ" | "SABQI" | "MANZIL" | "MUFAR">("SABAQ");
  const [juz, setJuz] = useState("30");
  const [halamanMulai, setHalamanMulai] = useState("582");
  const [halamanSelesai, setHalamanSelesai] = useState("582");
  const [jumlahHalaman, setJumlahHalaman] = useState("1");
  const [jumlahJuzMufar, setJumlahJuzMufar] = useState("2");
  const [rincianJuzMufar, setRincianJuzMufar] = useState("Juz 1, 2");
  const [nilai, setNilai] = useState<"MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "DHOIF">("MUMTAZ");
  const [catatan, setCatatan] = useState("");

  // Handler cerdas saat Juz diubah (otomatis sesuaikan Halaman Mulai & Selesai)
  const handleJuzChange = (val: string) => {
    setJuz(val);
    const parsedJuz = parseInt(val, 10);
    if (!isNaN(parsedJuz) && parsedJuz >= 1 && parsedJuz <= 30) {
      const juzMeta = JUZ_LIST.find((j) => j.juz === parsedJuz);
      if (juzMeta) {
        setHalamanMulai(String(juzMeta.startPage));
        const jml = parseFloat(jumlahHalaman) || 1;
        setHalamanSelesai(String(juzMeta.startPage + Math.ceil(jml) - 1));
      }
    }
  };

  // Handler cerdas saat Halaman Mulai diubah (otomatis deteksi Juz & sinkronkan Halaman Selesai)
  const handleHalamanMulaiChange = (val: string) => {
    setHalamanMulai(val);
    const start = parseInt(val, 10);
    if (!isNaN(start) && start >= 1 && start <= 604) {
      const detectedJuz = getJuzByPage(start);
      if (detectedJuz && String(detectedJuz) !== juz) {
        setJuz(String(detectedJuz));
      }
      const jml = parseFloat(jumlahHalaman) || 1;
      setHalamanSelesai(String(start + Math.ceil(jml) - 1));
    }
  };

  // Handler cerdas saat Jumlah Halaman diubah (otomatis sesuaikan Halaman Selesai)
  const handleJumlahHalamanChange = (val: string) => {
    setJumlahHalaman(val);
    const jml = parseFloat(val);
    const start = parseInt(halamanMulai, 10) || 1;
    if (!isNaN(jml) && jml > 0) {
      setHalamanSelesai(String(start + Math.ceil(jml) - 1));
    }
  };

  // Handler saat Halaman Selesai diubah secara manual (otomatis hitung Jumlah Halaman)
  const handleHalamanSelesaiChange = (val: string) => {
    setHalamanSelesai(val);
    const end = parseInt(val, 10);
    const start = parseInt(halamanMulai, 10) || 1;
    if (!isNaN(end) && end >= start) {
      const count = end - start + 1;
      setJumlahHalaman(String(count));
    }
  };

  // Handler saat santri dipilih: sinkronkan ke posisi lanjutan hafalan santri
  const handleSelectSantri = (nis: string) => {
    setSelectedSantriNis(nis);
    const targetSantri = santriList.find((s) => s.nis === nis);
    if (targetSantri) {
      const modal = targetSantri.modalHalamanAwal ?? targetSantri.totalHalaman ?? ((targetSantri.capaianJuz || 0) * HALAMAN_PER_JUZ);
      const nextHlm = Math.min(604, Math.max(1, modal + 1));
      const nextJuz = getJuzByPage(nextHlm);
      setHalamanMulai(String(nextHlm));
      const jml = parseFloat(jumlahHalaman) || 1;
      setHalamanSelesai(String(nextHlm + Math.ceil(jml) - 1));
      setJuz(String(nextJuz));
    }
  };

  // Riwayat setoran lokal dalam memori (disinkronkan dengan server)
  const [recentSetoran, setRecentSetoran] = useState<Array<{
    id: string;
    santriNama: string;
    santriNis: string;
    kelas: string;
    jenis: string;
    juz: number;
    halamanMulai?: number;
    halamanSelesai?: number;
    jumlahHalaman?: number;
    nilai: string;
    tanggal: string;
  }>>([
    {
      id: "set-1",
      santriNama: santriList[0]?.nama || "Obama Ozearld",
      santriNis: santriList[0]?.nis || "SAN-0001",
      kelas: santriList[0]?.kelas || "9A",
      jenis: "SABAQ",
      juz: 22,
      halamanMulai: 421,
      halamanSelesai: 421,
      jumlahHalaman: 1,
      nilai: "MUMTAZ",
      tanggal: "Hari Ini, 07:15 WITA",
    },
    {
      id: "set-2",
      santriNama: santriList[1]?.nama || "Muhammad Fardhan",
      santriNis: santriList[1]?.nis || "SAN-0002",
      kelas: santriList[1]?.kelas || "9A",
      jenis: "SABQI",
      juz: 16,
      halamanMulai: 318,
      halamanSelesai: 320,
      jumlahHalaman: 3,
      nilai: "JAYYID_JIDDAN",
      tanggal: "Hari Ini, 07:40 WITA",
    },
  ]);

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
    title: "Kirim Laporan Setoran via WhatsApp",
    description: "Format laporan resmi DUC akan dikirimkan kepada wali santri.",
  });

  // Santri yang sedang dipilih
  const activeSantri = santriList.find((s) => s.nis === selectedSantriNis) || santriList[0];

  // Kalkulasi Cerdas Halaman & Konversi Juz Dinamis untuk Santri Manapun
  const santriModalAwal = useMemo(() => {
    if (!activeSantri) return 0;
    if (activeSantri.modalHalamanAwal !== undefined) return activeSantri.modalHalamanAwal;
    if (activeSantri.totalHalaman !== undefined) return activeSantri.totalHalaman;
    return (activeSantri.capaianJuz || 0) * HALAMAN_PER_JUZ;
  }, [activeSantri]);

  const parsedTambahanHlm = useMemo(() => {
    const n = parseFloat(jumlahHalaman);
    return isNaN(n) || n < 0 ? 0 : n;
  }, [jumlahHalaman]);

  const akumulasiHalamanBaru = useMemo(() => {
    return santriModalAwal + parsedTambahanHlm;
  }, [santriModalAwal, parsedTambahanHlm]);

  const smartKonversiAwal = useMemo(() => konversiHalamanKeJuz(santriModalAwal), [santriModalAwal]);
  const smartKonversiAkumulasi = useMemo(() => konversiHalamanKeJuz(akumulasiHalamanBaru), [akumulasiHalamanBaru]);

  // Handler Simpan Setoran (Single source of truth)
  const handleSaveSetoran = () => {
    setFeedback(null);
    if (!["MT", "PH", "KS"].includes(userRole)) {
      setFeedback({ type: "error", message: `Role '${userRole}' tidak berhak input setoran tahfizh.` });
      return;
    }
    if (!activeSantri) {
      setFeedback({ type: "error", message: "Silakan pilih santri terlebih dahulu." });
      return;
    }

    startTransition(async () => {
      const hlmMulaiNum = parseInt(halamanMulai, 10) || 1;
      const jmlHlmNum = parseFloat(jumlahHalaman) || 1;
      const hlmSelesaiNum = parseInt(halamanSelesai, 10) || (hlmMulaiNum + Math.ceil(jmlHlmNum) - 1);
      const juzNum = parseInt(juz, 10) || getJuzByPage(hlmMulaiNum) || 1;

      let catatanRincian = "";
      if (inputJenis === "SABAQ") {
        catatanRincian = `[Sabaq: ${jmlHlmNum} Hlm (Hlm ${hlmMulaiNum}–${hlmSelesaiNum}) | Akumulasi: ${akumulasiHalamanBaru} Hlm (${smartKonversiAkumulasi.label})]`;
      } else if (inputJenis === "SABQI") {
        catatanRincian = `[Sabqi: Hlm ${hlmMulaiNum}–${hlmSelesaiNum} (${jmlHlmNum} Hlm, Juz ${juzNum})]`;
      } else if (inputJenis === "MANZIL") {
        catatanRincian = `[Manzil: 1 Juz Penuh (Juz ${juzNum}, 20 Halaman)]`;
      } else {
        catatanRincian = `[Mufar: ${jumlahJuzMufar} Juz (${rincianJuzMufar || `Juz ${juzNum}`})]`;
      }

      const finalCatatan = catatan ? `${catatanRincian}. ${catatan}`.trim() : catatanRincian;

      const res = await createSetoranAction({
        santriId: activeSantri.id,
        jenis: inputJenis,
        juz: juzNum,
        halamanMulai: hlmMulaiNum,
        halamanSelesai: hlmSelesaiNum,
        halaman: hlmMulaiNum,
        jumlahHalaman: jmlHlmNum,
        nilai,
        catatan: finalCatatan,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Alhamdulillah! Setoran ${inputJenis} untuk ${activeSantri.nama} (${jmlHlmNum} Hlm, Juz ${juzNum}) berhasil disimpan ke server.`,
        });

        const setoranId = res.data?.id || `set-${Date.now()}`;
        setRecentSetoran((prev) => [
          {
            id: setoranId,
            santriNama: activeSantri.nama,
            santriNis: activeSantri.nis,
            kelas: activeSantri.kelas,
            jenis: inputJenis,
            juz: juzNum,
            halamanMulai: hlmMulaiNum,
            halamanSelesai: hlmSelesaiNum,
            jumlahHalaman: jmlHlmNum,
            nilai,
            tanggal: "Baru saja",
          },
          ...prev,
        ]);

        // Siapkan pesan WA resmi dengan metrik halaman cerdas (Tanpa kolom Surah)
        const waMsg = buildSetoranTahfizhWAMessage({
          santriNama: activeSantri.nama,
          santriNis: activeSantri.nis,
          kelas: activeSantri.kelas,
          pembinaNama: currentUserName,
          jenisSetoran: inputJenis,
          juz: juzNum,
          halamanMulai: hlmMulaiNum,
          halamanSelesai: hlmSelesaiNum,
          nilai,
          catatan,
          jumlahHalaman: jmlHlmNum,
          totalHalamanKumulatif: inputJenis === "SABAQ" ? akumulasiHalamanBaru : undefined,
          konversiLabel: inputJenis === "SABAQ" ? smartKonversiAkumulasi.label : undefined,
        });

        // Ambil nomor kontak wali riil dari santri terpilih
        const guardianPhone = (res.data?.santri as unknown as { noHpWali?: string })?.noHpWali || (activeSantri as unknown as { noHpWali?: string })?.noHpWali || "";
        if (guardianPhone) {
          setWaDialog({
            isOpen: true,
            phone: guardianPhone,
            recipientName: `Wali dari ${activeSantri.nama}`,
            message: waMsg,
            title: "Kirim Laporan Setoran ke Wali Santri",
            description: `Kirim laporan mutaba'ah setoran resmi untuk ${activeSantri.nama} via WhatsApp.`,
          });
        }
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Gagal menyimpan setoran. Silakan periksa kembali isian.",
        });
      }
    });
  };

  // -------------------------------------------------------------
  // TAB IKHTIBAR: ALUR PENDAFTARAN & PENILAIAN UJIAN 2-TAHAP
  // -------------------------------------------------------------
  const [ikhtibarList, setIkhtibarList] = useState<Array<{
    id: string;
    santriNama: string;
    santriNis: string;
    santriId: string;
    kelas: string;
    juz: number;
    status: string;
    tahap: 1 | 2;
    penguji: string;
    nilai: number | null;
    catatan: string | null;
  }>>([
    {
      id: "ikh-1",
      santriNama: "Obama Ozearld Egberted Turizqi",
      santriNis: "SAN-0001",
      santriId: "cm_santri_1",
      kelas: "9A",
      juz: 22,
      status: "MENUNGGU_TAHAP_1",
      tahap: 1,
      penguji: "Ust. Razan Mufli, S.Pd",
      nilai: null,
      catatan: null,
    },
    {
      id: "ikh-2",
      santriNama: "Muhammad Fardhan",
      santriNis: "SAN-0002",
      santriId: "cm_santri_2",
      kelas: "9A",
      juz: 16,
      status: "LULUS_TAHAP_1",
      tahap: 2,
      penguji: "Mudir Pesantren (Ust. Andi Quarzy)",
      nilai: 92,
      catatan: "Tajwid & kelancaran sangat baik pada Tahap 1",
    },
    {
      id: "ikh-3",
      santriNama: "Muh. Fauzan",
      santriNis: "SAN-0003",
      santriId: "cm_santri_3",
      kelas: "9A",
      juz: 19,
      status: "LULUS_SEMPURNA_TAHAP_2",
      tahap: 2,
      penguji: "Mudir Pesantren",
      nilai: 95,
      catatan: "Disahkan Mudir Pesantren. Sah tuntas Juz 19.",
    },
  ]);

  // Modal Pendaftaran Ikhtibar Baru (Tahap 5)
  const [showAjukanModal, setShowAjukanModal] = useState(false);
  const [ajukanSantriNis, setAjukanSantriNis] = useState(santriList[0]?.nis || "");
  const [ajukanJuz, setAjukanJuz] = useState("1");

  const [gradingUjian, setGradingUjian] = useState<{
    id: string;
    santriNama: string;
    santriNis: string;
    juz: number;
    tahap: 1 | 2;
    penguji: string;
  } | null>(null);

  const [inputNilaiIkhtibar, setInputNilaiIkhtibar] = useState("");
  const [inputCatatanIkhtibar, setInputCatatanIkhtibar] = useState("");
  const [inputHasilTahap2, setInputHasilTahap2] = useState<"LULUS" | "MENGULANG_SEBAGIAN" | "MENGULANG_SATU_JUZ">("LULUS");

  const handleAjukanIkhtibar = () => {
    const target = santriList.find((s) => s.nis === ajukanSantriNis);
    if (!target) {
      setFeedback({ type: "error", message: "Pilih santri terlebih dahulu." });
      return;
    }
    const j = parseInt(ajukanJuz) || 1;
    if (j < 1 || j > 30) {
      setFeedback({ type: "error", message: "Juz ikhtibar harus antara 1 sampai 30." });
      return;
    }

    startTransition(async () => {
      const res = await ajukanIkhtibarAction({
        santriId: target.id,
        juz: j,
      });

      if (res.success && res.data) {
        setFeedback({
          type: "success",
          message: res.message || `Ikhtibar Juz ${j} untuk ${target.nama} berhasil didaftarkan.`,
        });
        const resData = res.data as { id?: string };
        const newIkh = {
          id: resData?.id || `ikh-${Date.now()}`,
          santriNama: target.nama,
          santriNis: target.nis,
          santriId: target.id,
          kelas: target.kelas,
          juz: j,
          status: "PENGAJUAN",
          tahap: 1 as const,
          penguji: currentUserName || "Musyrif Tahfizh",
          nilai: null,
          catatan: null,
        };
        setIkhtibarList((prev) => [newIkh, ...prev]);
        setShowAjukanModal(false);
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Gagal mengajukan ikhtibar.",
        });
      }
    });
  };

  const handleOpenGrading = (item: typeof ikhtibarList[0]) => {
    setGradingUjian({
      id: item.id,
      santriNama: item.santriNama,
      santriNis: item.santriNis,
      juz: item.juz,
      tahap: item.tahap,
      penguji: item.penguji,
    });
    setInputNilaiIkhtibar(item.nilai !== null ? String(item.nilai) : "");
    setInputCatatanIkhtibar(item.catatan || "");
    setInputHasilTahap2(
      item.status === "MENGULANG_SEBAGIAN"
        ? "MENGULANG_SEBAGIAN"
        : item.status === "MENGULANG_SATU_JUZ"
        ? "MENGULANG_SATU_JUZ"
        : "LULUS"
    );
  };

  const handleSimpanNilaiIkhtibar = () => {
    if (!gradingUjian) return;
    if (!inputNilaiIkhtibar.trim()) {
      setFeedback({ type: "error", message: "Nilai ujian tidak boleh kosong." });
      return;
    }
    const numNilai = parseFloat(inputNilaiIkhtibar) || 0;
    const isLulusTahap1 = numNilai >= 75;

    startTransition(async () => {
      let res;
      if (gradingUjian.tahap === 1) {
        res = await inputHasilTahap1Action({
          ikhtibarId: gradingUjian.id,
          nilai: numNilai,
          catatan: inputCatatanIkhtibar,
          lulus: isLulusTahap1,
        });
      } else {
        res = await inputHasilTahap2Action({
          ikhtibarId: gradingUjian.id,
          nilai: numNilai,
          catatan: inputCatatanIkhtibar,
          lulus: inputHasilTahap2 === "LULUS",
          hasilTahap2: inputHasilTahap2,
        });
      }

      if (res.success) {
        const resultLabel = gradingUjian.tahap === 1
          ? (isLulusTahap1 ? "LULUS TAHAP 1" : "MENGULANG")
          : (inputHasilTahap2 === "LULUS" ? "LULUS SEMPURNA" : inputHasilTahap2 === "MENGULANG_SEBAGIAN" ? "MENGULANG SEBAGIAN" : "MENGULANG 1 JUZ");

        setFeedback({
          type: "success",
          message: `Nilai ujian Juz ${gradingUjian.juz} untuk ${gradingUjian.santriNama} berhasil disimpan (${resultLabel}).`,
        });
        setIkhtibarList((prev) =>
          prev.map((item) =>
            item.id === gradingUjian.id
              ? {
                  ...item,
                  status: gradingUjian.tahap === 1
                    ? (isLulusTahap1 ? "LULUS_TAHAP_1" : "MENGULANG")
                    : (inputHasilTahap2 === "LULUS" ? "LULUS_SEMPURNA_TAHAP_2" : inputHasilTahap2),
                  tahap: isLulusTahap1 && gradingUjian.tahap === 1 ? 2 : gradingUjian.tahap,
                  penguji: isLulusTahap1 && gradingUjian.tahap === 1 ? "Mudir Pesantren (KS)" : item.penguji,
                  nilai: numNilai,
                  catatan: inputCatatanIkhtibar,
                }
              : item
          )
        );
        setGradingUjian(null);
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal menyimpan nilai ujian." });
      }
    });
  };

  // Pencarian riwayat setoran
  const [searchFilter, setSearchFilter] = useState("");
  const filteredRecentSetoran = recentSetoran.filter(
    (s) =>
      s.santriNama.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.santriNis.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. Sub-Navigasi Tahfizh: Setoran | Laporan Bulanan | Ujian Ikhtibar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab("setoran")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "setoran"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <BookCheck className="h-4 w-4" />
            Setoran Harian
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("laporan")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "laporan"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Rekap Bulanan DUC
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("ikhtibar")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "ikhtibar"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <Award className="h-4 w-4" />
            Ujian Ikhtibar
          </button>
        </div>

        {currentHalaqohName && (
          <span className="hidden lg:inline text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            {currentHalaqohName}
          </span>
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
            aria-label="Tutup Notifikasi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 2. TAB 1: FORM INPUT SETORAN & RIWAYAT TERKINI (PROPORSI HARMONIS 7 : 5) */}
      {activeSubTab === "setoran" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Kolom Kiri: Formulir Setoran Terpadu (Spacious & Proporsional: lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-4">
            <Card rounded="3xl" className="border border-slate-200 shadow-xs">
              <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
                  <BookCheck className="h-5 w-5 text-[#0E7C3A]" />
                  Catat Setoran Hafalan
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Input setoran berbasis halaman standar Mushaf Madinah (Metode Al-Pakistani)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {/* Pilih Santri */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Nama Santri
                  </label>
                  <select
                    value={selectedSantriNis}
                    onChange={(e) => handleSelectSantri(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0E7C3A]/20 transition-colors"
                  >
                    {santriList.map((s) => {
                      const totalHlm = s.modalHalamanAwal ?? s.totalHalaman ?? (s.capaianJuz * 20);
                      const konv = konversiHalamanKeJuz(totalHlm);
                      return (
                        <option key={s.nis} value={s.nis}>
                          {s.nama} ({s.kelas}) — Modal: {totalHlm} Hlm ({konv.label})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Jenis Setoran (Metode Al-Pakistani) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Metode Setoran (Al-Pakistani)
                    </label>
                    <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Kurikulum Inti STQ
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["SABAQ", "SABQI", "MANZIL", "MUFAR"] as const).map((j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => setInputJenis(j)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center min-h-[42px] flex flex-col items-center justify-center ${
                          inputJenis === j
                            ? "bg-[#0E7C3A] text-white border-[#0E7C3A] shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <span>
                          {j === "SABAQ"
                            ? "1. Sabaq"
                            : j === "SABQI"
                            ? "2. Sabqi"
                            : j === "MANZIL"
                            ? "3. Manzil"
                            : "4. Mufar"}
                        </span>
                        <span className="text-[10px] font-normal opacity-90 mt-0.5">
                          {j === "SABAQ"
                            ? "Hafalan Baru"
                            : j === "SABQI"
                            ? "Muroja'ah Sepekan"
                            : j === "MANZIL"
                            ? "Muroja'ah 1 Juz"
                            : "Harian 1-6 Juz"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* FITUR PINTAR OTOMATIS: KALKULASI HALAMAN & JUZ (KHUSUS SABAQ) */}
                {inputJenis === "SABAQ" ? (
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-50 border border-emerald-300/80 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-xs">
                          <Calculator className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="text-xs font-extrabold text-emerald-950 block">
                            Fitur Pintar Otomatis Konversi Hafalan
                          </span>
                          <span className="text-[10px] text-emerald-700 font-medium">
                            Standar Mushaf Madinah: 1 Juz = 20 Halaman
                          </span>
                        </div>
                      </div>
                      <Badge variant="green" size="sm" className="font-mono text-[10px]">
                        Auto-Calculated
                      </Badge>
                    </div>

                    {/* Metric Cards Grid: 4 Kolom Proporsional */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                      <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-200/80 text-center shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Modal Awal
                        </span>
                        <span className="text-base font-black text-slate-900 block mt-0.5">
                          {santriModalAwal} Hlm
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                          {smartKonversiAwal.label}
                        </span>
                      </div>

                      <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-200/80 text-center shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Tambah Hari Ini
                        </span>
                        <span className="text-base font-black text-emerald-700 block mt-0.5">
                          +{parsedTambahanHlm} Hlm
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Sabaq Baru
                        </span>
                      </div>

                      <div className="bg-white/95 p-2.5 rounded-xl border border-emerald-200/80 text-center shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Total Akumulasi
                        </span>
                        <span className="text-base font-black text-slate-900 block mt-0.5">
                          {akumulasiHalamanBaru} Hlm
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {santriModalAwal} + {parsedTambahanHlm}
                        </span>
                      </div>

                      <div className="bg-gradient-to-br from-[#0E7C3A] to-emerald-700 p-2.5 rounded-xl text-white text-center shadow-xs flex flex-col justify-center">
                        <span className="text-[10px] uppercase font-bold text-emerald-100 block">
                          Otomatis Menjadi
                        </span>
                        <span className="text-xs sm:text-sm font-black text-white block mt-0.5">
                          {smartKonversiAkumulasi.label}
                        </span>
                        <span className="text-[9px] text-emerald-200 block mt-0.5">
                          {Math.floor(akumulasiHalamanBaru / 20)} Juz {akumulasiHalamanBaru % 20} Hlm
                        </span>
                      </div>
                    </div>

                    {/* Quick addition buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-emerald-200/60">
                      <span className="text-[11px] font-semibold text-slate-600">
                        Pilihan Cepat Tambah:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {["0.5", "1", "2", "3", "5", "7"].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleJumlahHalamanChange(val)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              jumlahHalaman === val
                                ? "bg-[#0E7C3A] text-white shadow-xs"
                                : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100/60"
                            }`}
                          >
                            +{val} Hlm
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Keterangan Sistem Dinamis (Tanpa teks nama santri statis) */}
                    <div className="p-2.5 rounded-xl bg-white/70 border border-emerald-200/70 text-[11px] text-slate-700 leading-relaxed flex items-start gap-2">
                      <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        Standar mushaf: <span className="font-semibold text-emerald-900">1 Juz = 20 Halaman</span>. Akumulasi hafalan dan konversi ke satuan Juz & Halaman dihitung otomatis oleh sistem secara dinamis untuk santri yang dipilih.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl p-3.5 bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                      Metode Al-Pakistani: {
                        inputJenis === "SABQI"
                          ? "Sabqi (Muroja'ah Hafalan Sepekan Terakhir)"
                          : inputJenis === "MANZIL"
                          ? "Manzil (Muroja'ah Hafalan Lama Hingga 1 Juz Penuh)"
                          : "Mufar (Muroja'ah Harian 1–6 Juz Sesuai Jumlah Hafalan)"
                      }
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      {inputJenis === "SABQI"
                        ? "Muroja'ah hafalan yang diperoleh selama satu pekan terakhir sebelum melanjutkan Sabaq baru."
                        : inputJenis === "MANZIL"
                        ? "Muroja'ah hafalan pada pekan-pekan sebelumnya secara bersiklus hingga mencapai satu juz penuh (20 halaman)."
                        : "Muroja'ah harian sebanyak 1–6 juz sesuai jumlah hafalan yang telah dimiliki santri guna menjaga kualitas dan kekuatan hafalan."}
                    </p>
                  </div>
                )}

                {/* PARAMETER SETORAN BERBASIS HALAMAN & JUZ (TANPA SURAH) */}
                {inputJenis === "SABAQ" && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Juz
                      </label>
                      <select
                        value={juz}
                        onChange={(e) => handleJuzChange(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      >
                        {JUZ_LIST.map((j) => (
                          <option key={j.juz} value={j.juz}>
                            Juz {j.juz} (Hlm {j.startPage}–{j.endPage})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 block">
                          Halaman Mulai
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">1–604</span>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={604}
                        value={halamanMulai}
                        onChange={(e) => handleHalamanMulaiChange(e.target.value)}
                        placeholder="e.g. 582"
                        className="min-h-[44px] font-semibold text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Jumlah Halaman
                      </label>
                      <Input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={jumlahHalaman}
                        onChange={(e) => handleJumlahHalamanChange(e.target.value)}
                        placeholder="1"
                        className="min-h-[44px] font-semibold text-sm"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 block">
                          Halaman Selesai
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">1–604</span>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={604}
                        value={halamanSelesai}
                        onChange={(e) => handleHalamanSelesaiChange(e.target.value)}
                        placeholder="e.g. 582"
                        className="min-h-[44px] font-semibold text-sm"
                      />
                    </div>
                  </div>
                )}

                {inputJenis === "SABQI" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Juz (1 - 30)
                      </label>
                      <select
                        value={juz}
                        onChange={(e) => handleJuzChange(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      >
                        {JUZ_LIST.map((j) => (
                          <option key={j.juz} value={j.juz}>
                            Juz {j.juz} (Hlm {j.startPage}–{j.endPage})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 block">
                          Halaman Mulai
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">1–604</span>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={604}
                        value={halamanMulai}
                        onChange={(e) => handleHalamanMulaiChange(e.target.value)}
                        className="min-h-[44px] font-semibold text-sm"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700 block">
                          Halaman Selesai
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">1–604</span>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={604}
                        value={halamanSelesai}
                        onChange={(e) => handleHalamanSelesaiChange(e.target.value)}
                        className="min-h-[44px] font-semibold text-sm"
                      />
                    </div>
                  </div>
                )}

                {inputJenis === "MANZIL" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Juz Dimuroja&apos;ah (1 Juz Penuh)
                      </label>
                      <select
                        value={juz}
                        onChange={(e) => handleJuzChange(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      >
                        {JUZ_LIST.map((j) => (
                          <option key={j.juz} value={j.juz}>
                            Juz {j.juz} (Halaman {j.startPage}–{j.endPage})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col justify-center bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                        Standar Manzil STQ
                      </span>
                      <p className="text-xs font-semibold text-emerald-950 mt-0.5">
                        1 Juz Penuh = 20 Halaman Mushaf Madinah
                      </p>
                    </div>
                  </div>
                )}

                {inputJenis === "MUFAR" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Target Muroja&apos;ah Harian
                      </label>
                      <select
                        value={jumlahJuzMufar}
                        onChange={(e) => setJumlahJuzMufar(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="1">1 Juz per hari</option>
                        <option value="2">2 Juz per hari</option>
                        <option value="3">3 Juz per hari</option>
                        <option value="4">4 Juz per hari</option>
                        <option value="5">5 Juz per hari</option>
                        <option value="6">6 Juz per hari</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Rincian Juz yang Disetor
                      </label>
                      <Input
                        value={rincianJuzMufar}
                        onChange={(e) => setRincianJuzMufar(e.target.value)}
                        placeholder="Contoh: Juz 1 s/d 2, atau Juz 16, 17"
                        className="min-h-[44px] font-semibold text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Nilai Setoran & Catatan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Predikat Kelancaran
                    </label>
                    <select
                      value={nilai}
                      onChange={(e) =>
                        setNilai(
                          e.target.value as "MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "DHOIF"
                        )
                      }
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="MUMTAZ">Mumtaz (Istimewa / Sangat Lancar)</option>
                      <option value="JAYYID_JIDDAN">Jayyid Jiddan (Baik Sekali)</option>
                      <option value="JAYYID">Jayyid (Baik)</option>
                      <option value="MAQBUL">Maqbul (Cukup)</option>
                      <option value="DHOIF">Dhoif (Perlu Mengulang)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Catatan Pembina (Opsional)
                    </label>
                    <Input
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      placeholder="Contoh: Makhraj huruf fa' dan kelancaran sangat tartil..."
                      className="min-h-[44px] text-sm"
                    />
                  </div>
                </div>

                <Button
                  variant="primary"
                  onClick={handleSaveSetoran}
                  disabled={isPending}
                  className="w-full min-h-[48px] font-bold text-sm bg-[#0E7C3A] hover:bg-[#0B642E] shadow-xs gap-2"
                >
                  <BookCheck className="h-4 w-4" />
                  {isPending ? "Menyimpan ke Server..." : "Simpan Setoran Santri"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Kolom Kanan: Feed Riwayat Setoran Terkini (Proporsional: lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-4">
            <Card rounded="3xl" className="border border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-slate-900 font-heading">
                      Riwayat Setoran Terkini
                    </CardTitle>
                    <span className="text-xs text-slate-400 font-medium">
                      {filteredRecentSetoran.length} Catatan
                    </span>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    Daftar hafalan santri yang telah direkam ke server
                  </CardDescription>
                  <div className="relative w-full mt-1">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Cari santri..."
                      className="pl-9 min-h-[38px] text-xs w-full"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredRecentSetoran.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {filteredRecentSetoran.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-xl bg-emerald-50 text-[#0E7C3A] font-bold text-xs shrink-0 border border-emerald-100 mt-0.5">
                            Juz {item.juz}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                                {item.santriNama}
                              </h4>
                              <Badge variant="green" size="sm" className="text-[10px] py-0 px-1.5">
                                {item.jenis}
                              </Badge>
                            </div>
                            <p className="text-xs font-semibold text-slate-700 mt-0.5">
                              {item.jenis === "MANZIL"
                                ? `1 Juz Penuh (20 Halaman)`
                                : item.jenis === "MUFAR"
                                ? `Muroja'ah Harian`
                                : item.halamanMulai && item.halamanSelesai && item.halamanMulai !== item.halamanSelesai
                                ? `Hlm ${item.halamanMulai}–${item.halamanSelesai} (${item.jumlahHalaman || 1} Halaman)`
                                : `Halaman ${item.halamanMulai || item.juz * 20} (${item.jumlahHalaman || 1} Halaman)`}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {item.tanggal}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Badge
                            variant={
                              item.nilai === "MUMTAZ"
                                ? "green"
                                : item.nilai === "JAYYID_JIDDAN"
                                ? "sky"
                                : "gold"
                            }
                            size="sm"
                            className="font-bold text-[10px]"
                          >
                            {item.nilai}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Belum ada riwayat setoran yang cocok dengan pencarian.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 3. TAB 2: REKAP LAPORAN BULANAN DUC (DESKTOP TABEL + HP ACCORDION) */}
      {activeSubTab === "laporan" && (
        <RekapLaporanBulanan
          halaqohList={halaqohList}
          userRole={userRole}
          onPrintPreview={onPrintPreview}
        />
      )}

      {/* 4. TAB 3: IKHTIBAR DENGAN PENGAJUAN RESMI & PEMISAHAN ANTREAN (TAHAP 5 & 7) */}
      {activeSubTab === "ikhtibar" && (
        <div className="space-y-6">
          {/* Antrean Ujian Ikhtibar Berjalan */}
          <Card rounded="3xl" className="border border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 font-heading">
                    Antrean Ujian Ikhtibar Berjalan (2-Tahap)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Ujian kelulusan juz: Tahap 1 oleh Musyrif Tahfizh, Tahap 2 Munaqasyah oleh Mudir Pesantren (Ambang Lulus: ≥ 75).
                  </CardDescription>
                </div>
                {["MT", "KS", "ADM"].includes(userRole) && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowAjukanModal(true)}
                    leftIcon={<PlusCircle className="h-4 w-4" />}
                    className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white text-xs font-bold shrink-0 min-h-[40px]"
                  >
                    Daftarkan Ikhtibar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="px-4 py-3">Nama Santri</th>
                    <th className="px-3 py-3 text-center">Juz</th>
                    <th className="px-3 py-3">Tahap Ujian</th>
                    <th className="px-3 py-3">Penguji Ditugaskan</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">Nilai</th>
                    <th className="px-4 py-3 text-center">Tindakan Penguji</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ikhtibarList
                    .filter((item) => item.status !== "LULUS_SEMPURNA_TAHAP_2")
                    .map((item) => {
                      const canGradeTahap1 = item.tahap === 1 && ["MT", "KS", "ADM"].includes(userRole);
                      const canGradeTahap2 = item.tahap === 2 && userRole === "KS";

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {item.santriNama}
                            <span className="block text-[11px] text-slate-400 font-normal">
                              {item.santriNis} • {item.kelas}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-extrabold text-[#0E7C3A]">
                            Juz {item.juz}
                          </td>
                          <td className="px-3 py-3 font-medium">
                            Tahap {item.tahap}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {item.penguji}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <Badge
                              variant={
                                item.status === "LULUS_TAHAP_1"
                                  ? "gold"
                                  : item.status === "MENGULANG_SEBAGIAN"
                                  ? "gold"
                                  : item.status === "MENGULANG_SATU_JUZ" || item.status === "MENGULANG"
                                  ? "orange"
                                  : "sky"
                              }
                              size="sm"
                            >
                              {item.status === "MENGULANG_SEBAGIAN"
                                ? "MENGULANG SEBAGIAN"
                                : item.status === "MENGULANG_SATU_JUZ"
                                ? "MENGULANG 1 JUZ"
                                : item.status.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-slate-800">
                            {item.nilai !== null ? item.nilai : "-"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {canGradeTahap1 ? (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenGrading(item)}
                                className="text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E] min-h-[36px]"
                              >
                                Nilai Tahap 1
                              </Button>
                            ) : canGradeTahap2 ? (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenGrading(item)}
                                className="text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white min-h-[36px]"
                              >
                                Munaqasyah Mudir
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                {item.tahap === 2 ? "Menunggu Ujian Mudir" : "Menunggu Musyrif"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {ikhtibarList.filter((item) => item.status !== "LULUS_SEMPURNA_TAHAP_2").length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                        Tidak ada antrean ujian ikhtibar berjalan saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Riwayat Kelulusan Ikhtibar Sah Tuntas */}
          <Card rounded="3xl" className="border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
            <CardHeader className="pb-3 border-b border-emerald-100">
              <CardTitle className="text-base font-bold text-emerald-950 font-heading">
                Riwayat Kelulusan Sempurna (Munaqasyah Tuntas)
              </CardTitle>
              <CardDescription className="text-xs text-emerald-800">
                Daftar santri yang telah dinyatakan sah tuntas ujian kelulusan juz oleh Mudir STQ
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-emerald-100/60 text-emerald-900 font-bold border-b border-emerald-200">
                    <th className="px-4 py-3">Nama Santri</th>
                    <th className="px-3 py-3 text-center">Juz Tuntas</th>
                    <th className="px-3 py-3">Penguji Pengesahan</th>
                    <th className="px-3 py-3 text-center">Nilai Akhir</th>
                    <th className="px-3 py-3 text-center">Status Kelulusan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {ikhtibarList
                    .filter((item) => item.status === "LULUS_SEMPURNA_TAHAP_2")
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-emerald-50/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {item.santriNama}
                          <span className="block text-[11px] text-slate-400 font-normal">
                            {item.santriNis} • {item.kelas}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-extrabold text-[#0E7C3A]">
                          Juz {item.juz}
                        </td>
                        <td className="px-3 py-3 text-slate-700 font-medium">
                          {item.penguji}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-emerald-800">
                          {item.nilai}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="green" size="sm" className="font-bold">
                            LULUS TUNTAS
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  {ikhtibarList.filter((item) => item.status === "LULUS_SEMPURNA_TAHAP_2").length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                        Belum ada riwayat kelulusan sempurna pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL PENDAFTARAN IKHTIBAR BARU (TAHAP 5) */}
      {showAjukanModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ajukan-ikhtibar-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 id="ajukan-ikhtibar-title" className="text-base font-bold text-slate-900 font-heading">
                  Pendaftaran Ujian Ikhtibar Juz
                </h3>
                <p className="text-xs text-slate-500">
                  Daftarkan santri yang telah menyelesaikan setoran satu juz penuh
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAjukanModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                aria-label="Tutup Dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Pilih Santri Peserta Ujian
                </label>
                <select
                  value={ajukanSantriNis}
                  onChange={(e) => setAjukanSantriNis(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white"
                >
                  {santriList.map((s) => (
                    <option key={s.id} value={s.nis}>
                      {s.nama} ({s.nis}) — {s.kelas}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Juz yang Diujikan (1 - 30)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={ajukanJuz}
                  onChange={(e) => setAjukanJuz(e.target.value)}
                  className="min-h-[44px] text-sm font-bold"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold">Ketentuan Pengujian:</p>
                <p>• Tahap 1: Ujian kelancaran & tajwid bersama Musyrif Tahfizh (Ambang Lulus: ≥ 75).</p>
                <p>• Tahap 2: Munaqasyah komprehensif & pengesahan resmi oleh Mudir Pesantren.</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowAjukanModal(false)}
                  className="min-h-[42px] text-xs font-semibold"
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAjukanIkhtibar}
                  disabled={isPending}
                  className="min-h-[42px] text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E]"
                >
                  {isPending ? "Mendaftarkan..." : "Daftarkan Santri"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG PENILAIAN UJIAN BERDASARKAN BARIS TERPILIH (POINT 7) */}
      {gradingUjian && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="grading-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 id="grading-modal-title" className="text-base font-bold text-slate-900 font-heading">
                  Nilai Ujian Ikhtibar Tahap {gradingUjian.tahap}
                </h3>
                <p className="text-xs text-slate-500">
                  {gradingUjian.santriNama} ({gradingUjian.santriNis}) — Juz {gradingUjian.juz}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGradingUjian(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                aria-label="Tutup Dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                <p><strong>Penguji:</strong> {gradingUjian.penguji}</p>
                <p><strong>Ambang Kelulusan:</strong> Nilai minimal 75</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nilai Angka Ujian (0 - 100)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={inputNilaiIkhtibar}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputNilaiIkhtibar(val);
                    const n = parseFloat(val);
                    if (!isNaN(n) && gradingUjian.tahap === 2) {
                      if (n >= 75) setInputHasilTahap2("LULUS");
                      else if (n >= 60) setInputHasilTahap2("MENGULANG_SEBAGIAN");
                      else setInputHasilTahap2("MENGULANG_SATU_JUZ");
                    }
                  }}
                  className="min-h-[44px] text-base font-bold"
                />
              </div>

              {/* Khusus Tahap 2 (Mudir): 3 Pilihan Keputusan Resmi Kurikulum STQ */}
              {gradingUjian.tahap === 2 && (
                <div className="space-y-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-800 block">
                    Keputusan Munaqasyah Mudir Pesantren:
                  </label>
                  <div className="space-y-1.5">
                    <label className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer text-xs transition-all ${
                      inputHasilTahap2 === "LULUS" ? "bg-emerald-50 border-emerald-300 font-bold text-emerald-900" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                      <input
                        type="radio"
                        name="hasilTahap2"
                        checked={inputHasilTahap2 === "LULUS"}
                        onChange={() => setInputHasilTahap2("LULUS")}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="block">✅ Lulus Sempurna (Sah Munaqasyah Tuntas)</span>
                        <span className="block text-[11px] font-normal text-slate-500">Santri disahkan tuntas Juz {gradingUjian.juz} oleh Mudir STQ</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer text-xs transition-all ${
                      inputHasilTahap2 === "MENGULANG_SEBAGIAN" ? "bg-amber-50 border-amber-300 font-bold text-amber-900" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                      <input
                        type="radio"
                        name="hasilTahap2"
                        checked={inputHasilTahap2 === "MENGULANG_SEBAGIAN"}
                        onChange={() => setInputHasilTahap2("MENGULANG_SEBAGIAN")}
                        className="mt-0.5 text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <span className="block">⚠️ Mengulang Sebagian (Maqra&apos;/Halaman Tertentu)</span>
                        <span className="block text-[11px] font-normal text-slate-500">Beberapa halaman perlu pemantapan tajwid/kelancaran</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer text-xs transition-all ${
                      inputHasilTahap2 === "MENGULANG_SATU_JUZ" ? "bg-red-50 border-red-300 font-bold text-red-900" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}>
                      <input
                        type="radio"
                        name="hasilTahap2"
                        checked={inputHasilTahap2 === "MENGULANG_SATU_JUZ"}
                        onChange={() => setInputHasilTahap2("MENGULANG_SATU_JUZ")}
                        className="mt-0.5 text-red-600 focus:ring-red-500"
                      />
                      <div>
                        <span className="block">🔄 Mengulang Satu Juz Penuh</span>
                        <span className="block text-[11px] font-normal text-slate-500">Memerlukan murojaah dan tasmi&apos; ulang satu juz secara keseluruhan</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Catatan Penguji
                </label>
                <textarea
                  rows={3}
                  value={inputCatatanIkhtibar}
                  onChange={(e) => setInputCatatanIkhtibar(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setGradingUjian(null)}
                  className="min-h-[42px] text-xs font-semibold"
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSimpanNilaiIkhtibar}
                  disabled={isPending}
                  className="min-h-[42px] text-xs font-bold bg-[#0E7C3A] hover:bg-[#0B642E]"
                >
                  {isPending ? "Menyimpan..." : "Simpan Keputusan Ujian"}
                </Button>
              </div>
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
