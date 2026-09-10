"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef, useCallback } from "react";
import { Role } from "@/types/auth";
import { DashboardSantriSummary } from "./beranda-module";
import { RekapLaporanBulanan } from "@/components/dashboard/rekap-laporan-bulanan";
import { RewardEvaluasiTab } from "@/components/dashboard/reward-evaluasi-tab";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  createSetoranAction,
  getRecentSetoranAction,
  getSetoranSabaqPekanSantriAction,
} from "@/app/actions/tahfizh";
import {
  inputHasilTahap1Action,
  inputHasilTahap2Action,
  ajukanIkhtibarAction,
  getDaftarIkhtibarAction,
} from "@/app/actions/ikhtibar";
import { type LaporanBulananData } from "@/app/actions/laporan-bulanan";
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
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  X,
  PlusCircle,
  Calculator,
  Info,
  Star,
  Loader2,
} from "lucide-react";
import {
  konversiHalamanKeJuz,
  hitungTargetMufar,
} from "@/lib/laporan-bulanan";

export interface TahfizhModuleProps {
  userRole: Role;
  currentUserName: string;
  currentHalaqohName?: string | null;
  santriList: DashboardSantriSummary[];
  halaqohList: Array<{ id: string; nama: string }>;
  initialOpenForm?: boolean;
  isKepalaBidangTahfidz?: boolean;
  onPrintPreview?: (data: LaporanBulananData) => void;
  onRefresh?: () => void;
}

export function TahfizhModule({
  userRole,
  currentUserName,
  currentHalaqohName,
  santriList,
  halaqohList,
  initialOpenForm = false,
  isKepalaBidangTahfidz,
  onPrintPreview,
  onRefresh,
}: TahfizhModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<"setoran" | "laporan" | "ikhtibar" | "reward_evaluasi">(
    initialOpenForm ? "setoran" : "setoran"
  );

  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal Peringatan Lompatan Urutan Hafalan (Sequence Jump Warning - Poin 6)
  const [jumpWarningModal, setJumpWarningModal] = useState<{
    isOpen: boolean;
    posisiTerakhir: number;
    saranHalaman: number;
    halamanInput: number;
    tipePerbedaan: "LOMPAT_MAJU" | "PENGULANGAN" | "MUNDUR";
    alasan: string;
  }>({
    isOpen: false,
    posisiTerakhir: 1,
    saranHalaman: 1,
    halamanInput: 1,
    tipePerbedaan: "LOMPAT_MAJU",
    alasan: "",
  });

  // -------------------------------------------------------------
  // FORM INPUT SETORAN TUNGGAL BERBASIS HALAMAN & JUZ
  // Menggunakan Primary Key database riil (CUID)
  // Nilai awal kosong / null-safe (P0 Lanjutan)
  // -------------------------------------------------------------
  const [selectedSantriId, setSelectedSantriId] = useState<string>("");
  const effectiveSantriId =
    selectedSantriId && santriList.some((s) => s.id === selectedSantriId)
      ? selectedSantriId
      : santriList[0]?.id || "";

  const [inputJenis, setInputJenis] = useState<"SABAQ" | "SABQI" | "MANZIL" | "MUFAR">("SABAQ");
  const [juz, setJuz] = useState("");
  const [halamanMulai, setHalamanMulai] = useState("");
  const [halamanSelesai, setHalamanSelesai] = useState("");
  const [jumlahHalaman, setJumlahHalaman] = useState("1");
  const [jumlahJuzMufar, setJumlahJuzMufar] = useState("2");
  const [rincianJuzMufar, setRincianJuzMufar] = useState("Juz 1, 2");
  const [nilai, setNilai] = useState<"MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "DHOIF">("MUMTAZ");
  const [catatan, setCatatan] = useState("");

  // Synchronous submit lock & Idempotency Key Ref & Tracking Saran Posisi
  const submitLockRef = useRef(false);
  const pendingRequestIdRef = useRef<string | null>(null);
  const suggestedPageRef = useRef<number | null>(null);
  const suggestedJmlRef = useRef<number | null>(1);
  const prevSantriIdRef = useRef<string>("");

  // -------------------------------------------------------------
  // SINKRONISASI SATU FUNGSI TERPUSAT POSISI SABAQ (P0 LANJUTAN)
  // -------------------------------------------------------------
  const applySuggestedSabaqPosition = useCallback((santri: DashboardSantriSummary | null | undefined) => {
    if (!santri) {
      setHalamanMulai("");
      setHalamanSelesai("");
      setJuz("");
      setJumlahHalaman("1");
      suggestedPageRef.current = null;
      suggestedJmlRef.current = 1;
      return;
    }

    const modalAwal = santri.modalHafalanAwalHalaman ?? santri.modalHalamanAwal ?? 0;
    const posisiTerakhir = santri.posisiTerakhirHalaman ?? modalAwal;
    const isParsial = Boolean(santri.isHalamanTerakhirParsial);

    let saranHlm: number;
    let saranJml: number;

    if (isParsial && posisiTerakhir > 0) {
      // Masih ada sisa 0.5 halaman pada nomor halaman yang sama
      saranHlm = posisiTerakhir;
      saranJml = 0.5;
    } else if (posisiTerakhir >= 604) {
      // Santri telah mencapai halaman akhir Mushaf (khatam 604 / 30 Juz Selesai)
      suggestedPageRef.current = null;
      suggestedJmlRef.current = null;
      setHalamanMulai("");
      setHalamanSelesai("");
      setJumlahHalaman("");
      setJuz("30");
      const mufarTgt = hitungTargetMufar(30);
      setJumlahJuzMufar(String(mufarTgt));
      setRincianJuzMufar(`Juz 1 s/d ${mufarTgt}`);
      pendingRequestIdRef.current = null;
      return;
    } else if (posisiTerakhir === 0) {
      // Belum ada modal dan belum ada sabaq
      saranHlm = 1;
      saranJml = 1;
    } else {
      // Posisi normal: posisiTerakhir + 1
      saranHlm = Math.min(604, posisiTerakhir + 1);
      saranJml = 1;
    }

    suggestedPageRef.current = saranHlm;
    suggestedJmlRef.current = saranJml;

    setHalamanMulai(String(saranHlm));
    const hlmSelesai = saranJml === 0.5 ? saranHlm : (saranHlm + Math.ceil(saranJml) - 1);
    setHalamanSelesai(String(hlmSelesai));
    setJumlahHalaman(String(saranJml));

    const detectedJuz = getJuzByPage(saranHlm) || 1;
    setJuz(String(detectedJuz));

    // Otomatis sinkronkan target Mufar dinamis sesuai capaian santri
    const mufarTgt = hitungTargetMufar(santri.capaianJuz || Math.floor(posisiTerakhir / 20) || 1);
    setJumlahJuzMufar(String(mufarTgt));
    setRincianJuzMufar(`Juz 1 s/d ${mufarTgt}`);

    // Reset requestId untuk form draft baru
    pendingRequestIdRef.current = null;
  }, []);

  // Handler cerdas saat Juz diubah (otomatis sesuaikan Halaman Mulai & Selesai)
  const handleJuzChange = (val: string) => {
    setJuz(val);
    pendingRequestIdRef.current = null;
    const parsedJuz = parseInt(val, 10);
    if (!isNaN(parsedJuz) && parsedJuz >= 1 && parsedJuz <= 30) {
      const juzMeta = JUZ_LIST.find((j) => j.juz === parsedJuz);
      if (juzMeta) {
        setHalamanMulai(String(juzMeta.startPage));
        const jml = parseFloat(jumlahHalaman) || 1;
        const end = jml === 0.5 ? juzMeta.startPage : (juzMeta.startPage + Math.ceil(jml) - 1);
        setHalamanSelesai(String(end));
      }
    }
  };

  // Handler cerdas saat Halaman Mulai diubah (otomatis deteksi Juz & sinkronkan Halaman Selesai)
  const handleHalamanMulaiChange = (val: string) => {
    setHalamanMulai(val);
    pendingRequestIdRef.current = null;
    const start = parseInt(val, 10);
    if (!isNaN(start) && start >= 1 && start <= 604) {
      const detectedJuz = getJuzByPage(start);
      if (detectedJuz && String(detectedJuz) !== juz) {
        setJuz(String(detectedJuz));
      }
      const jml = parseFloat(jumlahHalaman) || 1;
      const end = jml === 0.5 ? start : (start + Math.ceil(jml) - 1);
      setHalamanSelesai(String(end));
    }
  };

  // Handler cerdas saat Jumlah Halaman diubah (otomatis sesuaikan Halaman Selesai)
  const handleJumlahHalamanChange = (val: string) => {
    setJumlahHalaman(val);
    pendingRequestIdRef.current = null;
    const jml = parseFloat(val);
    const start = parseInt(halamanMulai, 10) || 1;
    if (!isNaN(jml) && jml > 0) {
      const end = jml === 0.5 ? start : (start + Math.ceil(jml) - 1);
      setHalamanSelesai(String(end));
    }
  };

  // Handler saat Halaman Selesai diubah secara manual (otomatis hitung Jumlah Halaman)
  const handleHalamanSelesaiChange = (val: string) => {
    setHalamanSelesai(val);
    pendingRequestIdRef.current = null;
    const end = parseInt(val, 10);
    const start = parseInt(halamanMulai, 10) || 1;
    if (!isNaN(end) && end >= start) {
      const count = end - start + 1;
      setJumlahHalaman(String(count));
    }
  };

  // Handler saat santri dipilih: sinkronkan ke posisi lanjutan hafalan santri
  const handleSelectSantri = (id: string) => {
    setSelectedSantriId(id);
    setIsManualSabaqi(false);
    setAlasanManualSabaqi("");
    const targetSantri = santriList.find((s) => s.id === id);
    if (targetSantri && inputJenis === "SABAQ") {
      applySuggestedSabaqPosition(targetSantri);
    }
  };

  // Efek sinkronisasi santri pertama kali / ketika berganti santri terpilih
  useEffect(() => {
    if (!effectiveSantriId) return;
    const targetSantri = santriList.find((s) => s.id === effectiveSantriId);
    if (targetSantri && (prevSantriIdRef.current !== effectiveSantriId || !halamanMulai)) {
      prevSantriIdRef.current = effectiveSantriId;
      if (inputJenis === "SABAQ") {
        const timer = setTimeout(() => {
          applySuggestedSabaqPosition(targetSantri);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [effectiveSantriId, santriList, inputJenis, halamanMulai, applySuggestedSabaqPosition]);

  // -------------------------------------------------------------
  // REKOMENDASI SABAQI PEKAN INI DARI DATABASE POSTGRESQL RIIL
  // -------------------------------------------------------------
  const [sabaqiPekan, setSabaqiPekan] = useState<{
    adaSabaqPekanIni: boolean;
    totalHalamanSabaq: number;
    halamanMulai: number | null;
    halamanSelesai: number | null;
    labelRentang: string;
    pesan: string;
  } | null>(null);
  const [isSabaqiLoading, setIsSabaqiLoading] = useState(false);
  const [isManualSabaqi, setIsManualSabaqi] = useState(false);
  const [alasanManualSabaqi, setAlasanManualSabaqi] = useState("");

  const loadSabaqiSantri = async (santriId: string) => {
    if (!santriId) return;
    setIsSabaqiLoading(true);
    try {
      const res = await getSetoranSabaqPekanSantriAction(santriId);
      if (res.success && res.data?.rekomendasi) {
        const rec = res.data.rekomendasi;
        setSabaqiPekan({
          adaSabaqPekanIni: rec.hasSabaq,
          totalHalamanSabaq: rec.totalHalaman,
          halamanMulai: rec.hasSabaq ? rec.halamanMulai : null,
          halamanSelesai: rec.hasSabaq ? rec.halamanSelesai : null,
          labelRentang: rec.labelLengkap,
          pesan: rec.sumberKeterangan,
        });
      } else {
        setSabaqiPekan(null);
      }
    } catch {
      setSabaqiPekan(null);
    } finally {
      setIsSabaqiLoading(false);
    }
  };

  useEffect(() => {
    if (!effectiveSantriId) return;
    let isMounted = true;
    getSetoranSabaqPekanSantriAction(effectiveSantriId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data?.rekomendasi) {
          const rec = res.data.rekomendasi;
          setSabaqiPekan({
            adaSabaqPekanIni: rec.hasSabaq,
            totalHalamanSabaq: rec.totalHalaman,
            halamanMulai: rec.hasSabaq ? rec.halamanMulai : null,
            halamanSelesai: rec.hasSabaq ? rec.halamanSelesai : null,
            labelRentang: rec.labelLengkap,
            pesan: rec.sumberKeterangan,
          });
        } else {
          setSabaqiPekan(null);
        }
      })
      .catch(() => {
        if (isMounted) setSabaqiPekan(null);
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveSantriId]);

  // Riwayat setoran riil dari server
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
  }>>([]);

  const loadRecentSetoran = async () => {
    try {
      const res = await getRecentSetoranAction(20);
      if (res.success && res.data) {
        setRecentSetoran(
          res.data.map((r) => ({
            id: r.id,
            santriNama: r.santri?.nama || "-",
            santriNis: r.santri?.nis || "-",
            kelas: r.santri?.kelas || "-",
            jenis: r.jenis,
            juz: r.juz,
            halamanMulai: r.halamanMulai,
            halamanSelesai: r.halamanSelesai,
            jumlahHalaman: r.jumlahHalaman,
            nilai: r.nilai,
            tanggal:
              new Date(r.tanggal).toLocaleString("id-ID", {
                timeZone: "Asia/Makassar",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }) + " WITA",
          }))
        );
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let isMounted = true;
    getRecentSetoranAction(20).then((res) => {
      if (isMounted && res.success && res.data) {
        setRecentSetoran(
          res.data.map((r) => ({
            id: r.id,
            santriNama: r.santri?.nama || "-",
            santriNis: r.santri?.nis || "-",
            kelas: r.santri?.kelas || "-",
            jenis: r.jenis,
            juz: r.juz,
            halamanMulai: r.halamanMulai,
            halamanSelesai: r.halamanSelesai,
            jumlahHalaman: r.jumlahHalaman,
            nilai: r.nilai,
            tanggal:
              new Date(r.tanggal).toLocaleString("id-ID", {
                timeZone: "Asia/Makassar",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }) + " WITA",
          }))
        );
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Santri yang sedang dipilih (Strict: Jangan fallback palsu ke index 0 jika belum ada yang terpilih)
  const activeSantri = santriList.find((s) => s.id === effectiveSantriId) || null;

  // Target Mufar Dinamis berdasarkan Total Capaian Hafalan Santri (Acuan Program Tahfidz STQ DUC 2026)
  const dynamicMufarTarget = useMemo(() => {
    const juzSantri = activeSantri ? (activeSantri.capaianJuz || Math.floor((activeSantri.totalHalaman || 0) / 20) || 1) : 1;
    return hitungTargetMufar(juzSantri);
  }, [activeSantri]);

  // Kalkulasi Cerdas Halaman & Konversi Juz Dinamis untuk Santri
  // Mengikuti formula resmi:
  // Total Hafalan = Modal Hafalan Awal + Total jumlahHalaman SABAQ setelah tanggal baseline
  const santriModalAwal = useMemo(() => {
    if (!activeSantri) return 0;
    return activeSantri.modalHafalanAwalHalaman ?? activeSantri.modalHalamanAwal ?? 0;
  }, [activeSantri]);

  const santriTambahanSabaq = useMemo(() => {
    if (!activeSantri) return 0;
    return activeSantri.tambahanSabaq ?? 0;
  }, [activeSantri]);

  const santriTotalHafalan = useMemo(() => {
    if (!activeSantri) return 0;
    return activeSantri.totalHafalan ?? (santriModalAwal + santriTambahanSabaq);
  }, [activeSantri, santriModalAwal, santriTambahanSabaq]);

  const santriPosisiTerakhir = useMemo(() => {
    if (!activeSantri) return 1;
    return activeSantri.posisiTerakhirHalaman ?? (santriModalAwal > 0 ? santriModalAwal : 1);
  }, [activeSantri, santriModalAwal]);

  const isKhatam30Juz = useMemo(() => {
    if (!activeSantri) return false;
    return santriPosisiTerakhir >= 604 && !activeSantri.isHalamanTerakhirParsial;
  }, [activeSantri, santriPosisiTerakhir]);

  // Handler otomatis menerapkan rentang Sabaqi dari setoran SABAQ aktif pekan berjalan ke form input
  const handleApplySabaqiReference = () => {
    if (sabaqiPekan && sabaqiPekan.adaSabaqPekanIni && sabaqiPekan.halamanMulai && sabaqiPekan.halamanSelesai) {
      setHalamanMulai(String(sabaqiPekan.halamanMulai));
      setHalamanSelesai(String(sabaqiPekan.halamanSelesai));
      setJumlahHalaman(String(sabaqiPekan.totalHalamanSabaq));
      const detected = getJuzByPage(sabaqiPekan.halamanMulai);
      if (detected) setJuz(String(detected));
    }
  };

  const parsedTambahanHlm = useMemo(() => {
    const n = parseFloat(jumlahHalaman);
    return isNaN(n) || n < 0 ? 0 : n;
  }, [jumlahHalaman]);

  // Akumulasi total hafalan setelah setoran SABAQ baru tersimpan:
  const akumulasiHalamanBaru = useMemo(() => {
    return santriTotalHafalan + (inputJenis === "SABAQ" ? parsedTambahanHlm : 0);
  }, [santriTotalHafalan, inputJenis, parsedTambahanHlm]);

  const smartKonversiAwal = useMemo(() => konversiHalamanKeJuz(santriModalAwal), [santriModalAwal]);
  const smartKonversiTotal = useMemo(() => konversiHalamanKeJuz(santriTotalHafalan), [santriTotalHafalan]);
  const smartKonversiAkumulasi = useMemo(() => konversiHalamanKeJuz(akumulasiHalamanBaru), [akumulasiHalamanBaru]);

  // Batas Juz aktif & validasi lintas juz (Poin 8)
  const currentStartPage = useMemo(() => {
    const p = parseInt(halamanMulai, 10);
    return isNaN(p) ? 1 : p;
  }, [halamanMulai]);

  const currentJuzMeta = useMemo(() => {
    if (currentStartPage < 1 || currentStartPage > 604) return null;
    return JUZ_LIST.find((j) => currentStartPage >= j.startPage && currentStartPage <= j.endPage) || null;
  }, [currentStartPage]);

  const maxPagesRemainingInJuz = useMemo(() => {
    if (!currentJuzMeta) return 20;
    return Math.max(0.5, currentJuzMeta.endPage - currentStartPage + 1);
  }, [currentJuzMeta, currentStartPage]);

  const isCrossJuzBoundary = useMemo(() => {
    if (currentStartPage < 1 || currentStartPage > 604) return false;
    const end = parseInt(halamanSelesai, 10);
    if (isNaN(end) || end < currentStartPage) return false;
    const juzMulai = getJuzByPage(currentStartPage);
    const juzSelesai = getJuzByPage(end);
    return Boolean(juzMulai && juzSelesai && juzMulai !== juzSelesai);
  }, [currentStartPage, halamanSelesai]);

  // Handler Simpan Setoran: Pemeriksaan Otorisasi, Lock, Validasi & Deteksi Perbedaan dari Saran
  const handleSaveSetoran = () => {
    setFeedback(null);
    if (submitLockRef.current || isSubmitting) {
      return;
    }
    if (!["MT", "PH", "KS"].includes(userRole)) {
      setFeedback({ type: "error", message: `Role '${userRole}' tidak berhak input setoran tahfizh.` });
      return;
    }
    if (!activeSantri) {
      setFeedback({ type: "error", message: "Silakan pilih santri terlebih dahulu." });
      return;
    }

    if (inputJenis === "SABAQ" && isKhatam30Juz) {
      setFeedback({
        type: "error",
        message: "Target hafalan 30 juz telah selesai. Tidak ada halaman Sabaq berikutnya.",
      });
      return;
    }

    if (inputJenis === "SABQI" && sabaqiPekan && !sabaqiPekan.adaSabaqPekanIni) {
      if (!isManualSabaqi || !alasanManualSabaqi.trim() || alasanManualSabaqi.trim().length < 5) {
        setFeedback({
          type: "error",
          message:
            "Belum ada Sabaq tersimpan pada pekan ini. Jika menggunakan input manual Sabaqi, centang opsi dan wajib masukkan alasan tertulis minimal 5 karakter.",
        });
        return;
      }
    }

    const hlmMulaiNum = parseInt(halamanMulai, 10);
    if (isNaN(hlmMulaiNum) || hlmMulaiNum < 1 || hlmMulaiNum > 604) {
      setFeedback({ type: "error", message: "Halaman mulai harus antara 1 sampai 604." });
      return;
    }

    // Poin 8: Cegah Setoran Melintasi Batas Juz
    if (isCrossJuzBoundary) {
      setFeedback({
        type: "error",
        message: `Setoran tidak boleh melintasi batas Juz. Halaman mulai (${halamanMulai}) dan selesai (${halamanSelesai}) berada pada juz berbeda. Maksimal sisa ${maxPagesRemainingInJuz} halaman untuk Juz ${currentJuzMeta?.juz || ""}.`,
      });
      return;
    }

    // Poin 6: Deteksi Perbedaan dari Posisi / Saran Otomatis (Khusus SABAQ)
    if (inputJenis === "SABAQ") {
      const modalAwal = activeSantri.modalHafalanAwalHalaman ?? activeSantri.modalHalamanAwal ?? 0;
      const posisiTerakhir = activeSantri.posisiTerakhirHalaman ?? modalAwal;
      const isParsial = Boolean(activeSantri.isHalamanTerakhirParsial);
      const suggested = suggestedPageRef.current ?? (isParsial && posisiTerakhir > 0 ? posisiTerakhir : (posisiTerakhir > 0 ? Math.min(604, posisiTerakhir + 1) : 1));

      if (hlmMulaiNum !== suggested) {
        let tipePerbedaan: "LOMPAT_MAJU" | "PENGULANGAN" | "MUNDUR" = "LOMPAT_MAJU";
        if (hlmMulaiNum > suggested) {
          tipePerbedaan = "LOMPAT_MAJU";
        } else if (hlmMulaiNum === posisiTerakhir && !isParsial) {
          tipePerbedaan = "PENGULANGAN";
        } else {
          tipePerbedaan = "MUNDUR";
        }

        setJumpWarningModal({
          isOpen: true,
          posisiTerakhir,
          saranHalaman: suggested,
          halamanInput: hlmMulaiNum,
          tipePerbedaan,
          alasan: "",
        });
        return;
      }
    }

    executeSaveSetoran();
  };

  // Eksekusi Simpan Setoran dengan Synchronous Submit Lock & Idempotency Key (Poin 11 & Poin 9)
  const executeSaveSetoran = (extra?: { alasanLompatanHalaman?: string }) => {
    if (submitLockRef.current || isSubmitting) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    if (!pendingRequestIdRef.current) {
      pendingRequestIdRef.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    const clientRequestId = pendingRequestIdRef.current;

    startTransition(async () => {
      try {
        const hlmMulaiNum = parseInt(halamanMulai, 10) || 1;
        const jmlHlmNum = parseFloat(jumlahHalaman) || 1;
        const hlmSelesaiNum = parseInt(halamanSelesai, 10) || (jmlHlmNum === 0.5 ? hlmMulaiNum : (hlmMulaiNum + Math.ceil(jmlHlmNum) - 1));
        const juzNum = parseInt(juz, 10) || getJuzByPage(hlmMulaiNum) || 1;

        let catatanRincian = "";
        if (inputJenis === "SABAQ") {
          catatanRincian = `[Sabaq: ${jmlHlmNum} Hlm (Hlm ${hlmMulaiNum}–${hlmSelesaiNum}) | Akumulasi: ${akumulasiHalamanBaru} Hlm (${smartKonversiAkumulasi.label})]`;
        } else if (inputJenis === "SABQI") {
          const manualTag = isManualSabaqi ? `[Manual Sabaqi: ${alasanManualSabaqi}] ` : "";
          catatanRincian = `${manualTag}[Sabqi: Hlm ${hlmMulaiNum}–${hlmSelesaiNum} (${jmlHlmNum} Hlm, Juz ${juzNum})]`;
        } else if (inputJenis === "MANZIL") {
          catatanRincian = `[Manzil: 1 Juz Penuh (Juz ${juzNum}, 20 Halaman)]`;
        } else {
          catatanRincian = `[Mufar: ${jumlahJuzMufar} Juz (${rincianJuzMufar || `Juz ${juzNum}`})]`;
        }

        const finalCatatan = catatan ? `${catatanRincian}. ${catatan}`.trim() : catatanRincian;

        const res = await createSetoranAction({
          santriId: activeSantri!.id,
          jenis: inputJenis,
          juz: juzNum,
          halamanMulai: hlmMulaiNum,
          halamanSelesai: hlmSelesaiNum,
          jumlahHalaman: jmlHlmNum,
          nilai,
          catatan: finalCatatan,
          clientRequestId,
          alasanLompatanHalaman: extra?.alasanLompatanHalaman,
          isManualSabaqi: inputJenis === "SABQI" ? isManualSabaqi : undefined,
          alasanManualSabaqi: inputJenis === "SABQI" && isManualSabaqi ? alasanManualSabaqi.trim() : undefined,
        });

        if (res.success) {
          // Posisi terbaru santri
          let posisiTerbaru = santriPosisiTerakhir;
          let isParsialBaru = false;
          if (inputJenis === "SABAQ") {
            posisiTerbaru = hlmSelesaiNum;
            isParsialBaru = jmlHlmNum === 0.5 && !activeSantri?.isHalamanTerakhirParsial;
          }

          // Feedback sukses standar di layar (Poin 9: Tanpa dialog WhatsApp)
          setFeedback({
            type: "success",
            message: `Alhamdulillah! Setoran ${inputJenis} untuk ${activeSantri!.nama} (${jmlHlmNum} Hlm, Juz ${juzNum}) berhasil disimpan. Posisi hafalan terkini: Halaman ${posisiTerbaru} (${smartKonversiAkumulasi.label}).`,
          });

          // Reset idempotency request id untuk form setoran berikutnya
          pendingRequestIdRef.current = null;

          // Perbarui saran posisi untuk setoran berikutnya (Poin 5)
          if (inputJenis === "SABAQ") {
            const updatedSantri: DashboardSantriSummary = {
              ...activeSantri!,
              posisiTerakhirHalaman: posisiTerbaru,
              isHalamanTerakhirParsial: isParsialBaru,
              tambahanSabaq: santriTambahanSabaq + jmlHlmNum,
              totalHafalan: santriTotalHafalan + jmlHlmNum,
            };
            applySuggestedSabaqPosition(updatedSantri);
          }

          // Trigger refresh parent & recent data
          onRefresh?.();
          loadRecentSetoran();
          if (activeSantri) loadSabaqiSantri(activeSantri.id);
        } else {
          setFeedback({
            type: "error",
            message: res.message || "Gagal menyimpan setoran. Silakan periksa kembali isian.",
          });
        }
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    });
  };

  // -------------------------------------------------------------
  // TAB IKHTIBAR: ALUR PENDAFTARAN & PENILAIAN UJIAN 2-TAHAP
  // Memuat data nyata dari PostgreSQL (Eliminasi cm_santri_*)
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
  }>>([]);
  useEffect(() => {
    let isMounted = true;
    getDaftarIkhtibarAction().then((res) => {
      if (isMounted && res.success && Array.isArray(res.data)) {
        interface RawIkhtibarItem {
          id: string;
          santri?: { nama?: string; nis?: string; kelas?: string };
          santriId: string;
          juz: number;
          status: string;
          pengujiTahap1?: { nama?: string };
          pengujiTahap2?: { nama?: string };
          nilaiTahap1?: number | null;
          nilaiTahap2?: number | null;
          catatanTahap1?: string | null;
          catatanTahap2?: string | null;
        }
        setIkhtibarList(
          (res.data as RawIkhtibarItem[]).map((item) => ({
            id: item.id,
            santriNama: item.santri?.nama || "-",
            santriNis: item.santri?.nis || "-",
            santriId: item.santriId,
            kelas: item.santri?.kelas || "-",
            juz: item.juz,
            status: item.status,
            tahap: item.status.includes("TAHAP_2") ? 2 : 1,
            penguji: item.pengujiTahap2?.nama || item.pengujiTahap1?.nama || "Belum Ditentukan",
            nilai: item.nilaiTahap2 ?? item.nilaiTahap1 ?? null,
            catatan: item.catatanTahap2 || item.catatanTahap1 || null,
          }))
        );
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

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
    <div data-testid="tahfizh-module" className="space-y-6">
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
          <button
            type="button"
            onClick={() => setActiveSubTab("reward_evaluasi")}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeSubTab === "reward_evaluasi"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <Star className="h-4 w-4" />
            Reward &amp; Evaluasi Bulanan
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
          data-testid={feedback.type === "success" ? "setoran-success" : "setoran-error"}
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
                  <label htmlFor="santri-selector" className="text-xs font-bold text-slate-700 block mb-1.5">
                    Nama Santri
                  </label>
                  <select
                    id="santri-selector"
                    value={effectiveSantriId}
                    onChange={(e) => handleSelectSantri(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0E7C3A]/20 transition-colors"
                  >
                    {santriList.length === 0 ? (
                      <option value="">Memuat data santri dari basis data...</option>
                    ) : (
                      santriList.map((s) => {
                        const modalAwal = s.modalHafalanAwalHalaman ?? s.modalHalamanAwal ?? 0;
                        const sabaq = s.tambahanSabaq ?? 0;
                        const total = s.totalHafalan ?? (modalAwal + sabaq);
                        const pos = s.posisiTerakhirHalaman ?? (modalAwal > 0 ? modalAwal : 1);
                        const konv = konversiHalamanKeJuz(total);
                        return (
                          <option key={s.id} value={s.id}>
                            {s.nama} ({s.kelas}) — {s.nis} — Modal: {modalAwal} Hlm | Sabaq: +{sabaq} Hlm | Total: {total} Hlm ({konv.label}) | Posisi: Hlm {pos}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                {/* STATUS HAFALAN SANTRI: PEMISAHAN 5 INFORMASI WAJIB (POIN 5) */}
                {activeSantri && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Status Capaian Hafalan Santri Saat Ini</span>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        {activeSantri.nama} ({activeSantri.nis})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center">
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          1. Modal Awal
                        </span>
                        <span className="text-sm font-black text-slate-800 block mt-0.5">
                          {santriModalAwal} Halaman
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {smartKonversiAwal.label}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          2. Tambahan Sabaq
                        </span>
                        <span className="text-sm font-black text-emerald-700 block mt-0.5">
                          +{santriTambahanSabaq} Halaman
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Tersimpan di DB
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-emerald-300 bg-emerald-50/40">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                          3. Total Hafalan
                        </span>
                        <span className="text-sm font-black text-emerald-900 block mt-0.5">
                          {santriTotalHafalan} Halaman
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          {smartKonversiTotal.label}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          4. Posisi Terakhir
                        </span>
                        <span className="text-sm font-black text-slate-800 block mt-0.5">
                          Halaman {santriPosisiTerakhir}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Juz {getJuzByPage(santriPosisiTerakhir)}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          5. Target Akhir
                        </span>
                        <span className="text-sm font-black text-slate-800 block mt-0.5">
                          {activeSantri.targetJuz ?? 30} Juz
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          600 Halaman
                        </span>
                      </div>
                    </div>
                  </div>
                )}

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
                        data-testid={`btn-jenis-${j.toLowerCase()}`}
                        type="button"
                        onClick={() => {
                          setInputJenis(j);
                          if (j === "SABAQ") {
                            applySuggestedSabaqPosition(activeSantri);
                          } else if (j === "MUFAR") {
                            setJumlahJuzMufar(String(dynamicMufarTarget));
                            setRincianJuzMufar(`Juz 1 s/d ${dynamicMufarTarget}`);
                          } else if (j === "SABQI") {
                            handleApplySabaqiReference();
                          }
                        }}
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

                {/* POSISI & KALKULASI HALAMAN & JUZ (KHUSUS SABAQ) */}
                {inputJenis === "SABAQ" && (
                  <div className="rounded-2xl p-4 bg-slate-50/80 border border-slate-200/90 shadow-2xs space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="p-1.5 bg-[#0E7C3A] text-white rounded-lg shadow-2xs">
                          <Calculator className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            Posisi &amp; Kalkulasi Hafalan
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Standar Mushaf Madinah: 1 Juz = 20 Halaman
                          </span>
                        </div>
                      </div>
                      <Badge variant="green" size="sm" className="font-mono text-[10px]">
                        Kalkulasi Otomatis
                      </Badge>
                    </div>

                    {isKhatam30Juz && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
                        <div className="flex items-center gap-2 font-bold text-[#0E7C3A] text-sm">
                          <CheckCircle2 className="w-4 h-4 text-[#0E7C3A] shrink-0" />
                          <span>Target hafalan 30 juz telah selesai.</span>
                        </div>
                        <p className="text-emerald-800 font-medium pl-6">
                          Tidak ada halaman Sabaq berikutnya.
                        </p>
                      </div>
                    )}

                    {/* Metric Cards Grid: 4 Kolom Proporsional */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Total Saat Ini
                        </span>
                        <span className="text-base font-bold text-slate-900 block mt-0.5">
                          {santriTotalHafalan} Hlm
                        </span>
                        <span className="text-[10px] text-[#0E7C3A] font-semibold block mt-0.5">
                          {smartKonversiTotal.label}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Tambah Hari Ini
                        </span>
                        <span className="text-base font-bold text-[#0E7C3A] block mt-0.5">
                          +{parsedTambahanHlm} Hlm
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Sabaq Baru
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Total Akumulasi
                        </span>
                        <span className="text-base font-bold text-slate-900 block mt-0.5">
                          {akumulasiHalamanBaru} Hlm
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {santriTotalHafalan} + {parsedTambahanHlm}
                        </span>
                      </div>

                      <div className="bg-[#0E7C3A] p-2.5 rounded-xl text-white text-center shadow-2xs flex flex-col justify-center">
                        <span className="text-[10px] uppercase font-bold text-emerald-100 block">
                          Total Konversi
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-white block mt-0.5">
                          {smartKonversiAkumulasi.label}
                        </span>
                        <span className="text-[10px] text-emerald-100 block mt-0.5">
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
                        {["0.5", "1", "2", "3", "5", "7"].map((val) => {
                          const numVal = parseFloat(val);
                          const exceedsJuzBoundary = Boolean(currentJuzMeta && numVal > maxPagesRemainingInJuz);
                          const isDisabled = isKhatam30Juz || exceedsJuzBoundary;

                          return (
                            <button
                              key={val}
                              data-testid={`btn-quick-add-${val}`}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => handleJumlahHalamanChange(val)}
                              title={
                                exceedsJuzBoundary && currentJuzMeta
                                  ? `Pilihan +${val} hlm melintasi batas Juz ${currentJuzMeta.juz} (sisa ${maxPagesRemainingInJuz} hlm hingga batas akhir hlm ${currentJuzMeta.endPage}).`
                                  : undefined
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                jumlahHalaman === val
                                  ? "bg-[#0E7C3A] text-white shadow-xs"
                                  : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100/60"
                              }`}
                            >
                              +{val} Hlm
                            </button>
                          );
                        })}
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
                )}

                {/* FITUR PINTAR REFERENSI SABAQI DARI DATABASE POSTGRESQL RIIL */}
                {inputJenis === "SABQI" && (
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-sky-50 via-blue-50/60 to-sky-50 border border-sky-300/80 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-sky-600 text-white rounded-lg shadow-xs">
                          <Clock className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="text-xs font-extrabold text-sky-950 block">
                            Rekomendasi Sabaqi Pekan Ini (Senin 00:00 WITA – Hari Ini)
                          </span>
                          <span className="text-[10px] text-sky-700 font-medium">
                            Dihitung otomatis dari akumulasi setoran SABAQ riil santri di database
                          </span>
                        </div>
                      </div>
                      {isSabaqiLoading && (
                        <Badge variant="sky" size="sm" className="font-semibold text-[10px] flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Memeriksa DB...
                        </Badge>
                      )}
                    </div>

                    {isSabaqiLoading ? (
                      <div className="p-4 text-center text-xs text-slate-400 bg-white/70 rounded-xl">
                        Memeriksa riwayat setoran Sabaq pekan berjalan dari basis data...
                      </div>
                    ) : sabaqiPekan && sabaqiPekan.adaSabaqPekanIni ? (
                      <div className="bg-white/95 p-3.5 rounded-xl border border-sky-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">
                            Akumulasi Sabaq Tersimpan Pekan Ini:
                          </span>
                          <span className="text-sm font-black text-sky-900 block mt-0.5">
                            {sabaqiPekan.labelRentang} ({sabaqiPekan.totalHalamanSabaq} Halaman)
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Muroja&apos;ah wajib sabqi pekanan santri sebelum menambah sabaq baru.
                          </span>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={handleApplySabaqiReference}
                          className="text-xs font-bold text-sky-800 border-sky-300 hover:bg-sky-50 min-h-[38px] shrink-0"
                        >
                          ✓ Terapkan ke Form Input
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-white/95 p-3.5 rounded-xl border border-amber-200/80 space-y-3 shadow-2xs">
                        <div className="flex items-start gap-2 text-amber-800">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold">Belum ada Sabaq tersimpan pada pekan ini.</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Santri belum memiliki catatan setoran jenis SABAQ sejak hari Senin 00:00 WITA pekan berjalan.
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isManualSabaqi}
                              onChange={(e) => setIsManualSabaqi(e.target.checked)}
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                            Gunakan Input Manual Sabaqi (Wajib isi alasan tertulis untuk dicatat ke audit log)
                          </label>

                          {isManualSabaqi && (
                            <div className="mt-2.5">
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                                Alasan Tertulis Input Manual Sabaqi:
                              </label>
                              <textarea
                                className="w-full border rounded-lg p-2 text-xs h-16 bg-amber-50/40 border-amber-200 focus:bg-white"
                                placeholder="Contoh: Mengulang sabaq pekan lalu karena izin sakit panjang."
                                value={alasanManualSabaqi}
                                onChange={(e) => setAlasanManualSabaqi(e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* FITUR PINTAR TARGET MUFAR DINAMIS RESMI STQ DUC 2026 */}
                {inputJenis === "MUFAR" && (
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-purple-50 via-violet-50/60 to-purple-50 border border-purple-300/80 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-purple-600 text-white rounded-lg shadow-xs">
                          <Award className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="text-xs font-extrabold text-purple-950 block">
                            Target Mufar Dinamis Resmi STQ DUC 2026
                          </span>
                          <span className="text-[10px] text-purple-700 font-medium">
                            Target harian otomatis menyesuaikan total capaian hafalan santri (Bukan frekuensi tetap)
                          </span>
                        </div>
                      </div>
                      <Badge variant="purple" size="sm" className="font-semibold text-[10px]">
                        Target: {dynamicMufarTarget} Juz/Hari
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-white/95 p-2.5 rounded-xl border border-purple-200/80 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Hafalan</span>
                        <span className="text-sm font-black text-slate-900 block mt-0.5">
                          {activeSantri?.capaianJuz || Math.floor(santriModalAwal / 20) || 1} Juz
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{smartKonversiAwal.label}</span>
                      </div>
                      <div className="bg-white/95 p-2.5 rounded-xl border border-purple-200/80 shadow-2xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Target Wajib</span>
                        <span className="text-sm font-black text-purple-700 block mt-0.5">
                          {dynamicMufarTarget} Juz / Hari
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Dinamis Otomatis</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-purple-700 to-indigo-700 p-2.5 rounded-xl text-white shadow-xs flex flex-col justify-center">
                        <span className="text-[10px] uppercase font-bold text-purple-200 block">Kategori Acuan</span>
                        <span className="text-xs font-black text-white block mt-0.5">
                          {(activeSantri?.capaianJuz || 1) <= 5
                            ? "1-5 Juz: 1 Juz/hari"
                            : (activeSantri?.capaianJuz || 1) <= 10
                            ? "6-10 Juz: 2 Juz/hari"
                            : (activeSantri?.capaianJuz || 1) <= 15
                            ? "11-15 Juz: 3 Juz/hari"
                            : (activeSantri?.capaianJuz || 1) <= 20
                            ? "16-20 Juz: 4 Juz/hari"
                            : "21-30 Juz: 5 Juz/hari"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* INFORMASI METODE MANZIL */}
                {inputJenis === "MANZIL" && (
                  <div className="rounded-2xl p-3.5 bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                      Metode Al-Pakistani: Manzil (Muroja&apos;ah Hafalan Lama Hingga 1 Juz Penuh)
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Muroja&apos;ah hafalan pada pekan-pekan sebelumnya secara bersiklus hingga mencapai satu juz penuh (20 halaman).
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
                        disabled={isKhatam30Juz}
                        onChange={(e) => handleJuzChange(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        id="halaman-mulai"
                        data-testid="input-halaman-mulai"
                        type="number"
                        min={1}
                        max={604}
                        disabled={isKhatam30Juz}
                        value={halamanMulai}
                        onChange={(e) => handleHalamanMulaiChange(e.target.value)}
                        placeholder="1"
                        className="min-h-[44px] font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Jumlah Halaman
                      </label>
                      <Input
                        id="jumlah-halaman"
                        data-testid="input-jumlah-halaman"
                        type="number"
                        min={0.5}
                        step={0.5}
                        disabled={isKhatam30Juz}
                        value={jumlahHalaman}
                        onChange={(e) => handleJumlahHalamanChange(e.target.value)}
                        placeholder="1"
                        className="min-h-[44px] font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                        id="halaman-selesai"
                        data-testid="input-halaman-selesai"
                        type="number"
                        min={1}
                        max={604}
                        disabled={isKhatam30Juz}
                        value={halamanSelesai}
                        onChange={(e) => handleHalamanSelesaiChange(e.target.value)}
                        placeholder="1"
                        className="min-h-[44px] font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                        Target Muroja&apos;ah Harian (Dinamis: {dynamicMufarTarget} Juz/hari)
                      </label>
                      <select
                        value={jumlahJuzMufar}
                        onChange={(e) => setJumlahJuzMufar(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="1">1 Juz per hari {dynamicMufarTarget === 1 ? "★ (Target Wajib Santri)" : ""}</option>
                        <option value="2">2 Juz per hari {dynamicMufarTarget === 2 ? "★ (Target Wajib Santri)" : ""}</option>
                        <option value="3">3 Juz per hari {dynamicMufarTarget === 3 ? "★ (Target Wajib Santri)" : ""}</option>
                        <option value="4">4 Juz per hari {dynamicMufarTarget === 4 ? "★ (Target Wajib Santri)" : ""}</option>
                        <option value="5">5 Juz per hari {dynamicMufarTarget === 5 ? "★ (Target Wajib Santri)" : ""}</option>
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

                {/* Banner Peringatan Lintas Batas Juz (Poin 8) */}
                {isCrossJuzBoundary && currentJuzMeta && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Setoran melintasi batas Juz {currentJuzMeta.juz}.</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Halaman mulai ({halamanMulai}) dan selesai ({halamanSelesai}) berada pada juz berbeda. Standar kurikulum STQ DUC: satu transaksi setoran harus dalam satu juz yang sama (maksimal hingga halaman {currentJuzMeta.endPage} untuk Juz {currentJuzMeta.juz}).
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  data-testid="btn-simpan-setoran"
                  variant="primary"
                  onClick={handleSaveSetoran}
                  disabled={
                    isSubmitting ||
                    isPending ||
                    !activeSantri ||
                    (inputJenis === "SABAQ" && isKhatam30Juz) ||
                    isCrossJuzBoundary
                  }
                  className="w-full min-h-[48px] font-bold text-sm bg-[#0E7C3A] hover:bg-[#0B642E] shadow-xs gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  <BookCheck className="h-4 w-4" />
                  {!activeSantri
                    ? "Pilih Santri Terlebih Dahulu"
                    : inputJenis === "SABAQ" && isKhatam30Juz
                    ? "Target Hafalan 30 Juz Telah Selesai"
                    : isCrossJuzBoundary
                    ? "Rentang Halaman Melintasi Batas Juz"
                    : isSubmitting || isPending
                    ? "Sedang menyimpan..."
                    : "Simpan Setoran Santri"}
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
                    Riwayat setoran santri yang tercatat di sistem
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
                        data-testid="recent-setoran-item"
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
          currentHalaqohName={currentHalaqohName}
          currentUserName={currentUserName}
          isKepalaBidangTahfidz={isKepalaBidangTahfidz}
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

      {/* 4. Tab Reward & Evaluasi Bulanan */}
      {activeSubTab === "reward_evaluasi" && (
        <RewardEvaluasiTab userRole={userRole} currentUserName={currentUserName} />
      )}

      {/* Peringatan Urutan Hafalan (Sequence Jump Warning Dialog - Poin 6) */}
      {jumpWarningModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <span className="p-2 bg-amber-100 rounded-xl text-amber-700">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <div>
                <h3 className="font-bold text-base text-slate-900 font-heading">
                  Konfirmasi Urutan Halaman Sabaq
                </h3>
                <span className="text-xs text-amber-700 font-semibold">
                  {jumpWarningModal.tipePerbedaan === "LOMPAT_MAJU"
                    ? "Hafalan melompat dari posisi seharusnya"
                    : jumpWarningModal.tipePerbedaan === "PENGULANGAN"
                    ? "Mengulang halaman yang sudah disetor penuh"
                    : "Menyetor halaman sebelum posisi terakhir"}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 mb-4 text-xs text-amber-950 leading-relaxed space-y-1.5">
              <div className="flex justify-between border-b border-amber-200/60 pb-1.5 mb-1.5 font-medium">
                <span>Posisi Terakhir Santri:</span>
                <span className="font-bold">Halaman {jumpWarningModal.posisiTerakhir}</span>
              </div>
              <div className="flex justify-between border-b border-amber-200/60 pb-1.5 mb-1.5 font-medium">
                <span>Saran Halaman Otomatis:</span>
                <span className="font-bold text-emerald-800">Halaman {jumpWarningModal.saranHalaman}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Halaman yang Anda Masukkan:</span>
                <span className="font-bold text-amber-900">Halaman {jumpWarningModal.halamanInput}</span>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Alasan Perubahan Urutan Halaman <span className="text-red-500">*</span>
              </label>
              <textarea
                data-testid="textarea-jump-alasan"
                value={jumpWarningModal.alasan}
                onChange={(e) => setJumpWarningModal((prev) => ({ ...prev, alasan: e.target.value }))}
                placeholder="Wajib masukkan alasan minimal 5 karakter (misal: akselerasi materi, setoran susulan, pengulangan karena belum lancar)..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Minimal 5 karakter. Alasan ini akan dicatat ke dalam audit log resmi.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setJumpWarningModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-xs font-bold min-h-[38px]"
              >
                Kembali periksa
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-testid="btn-confirm-jump"
                disabled={isSubmitting || !jumpWarningModal.alasan.trim() || jumpWarningModal.alasan.trim().length < 5}
                onClick={() => {
                  const alasan = jumpWarningModal.alasan.trim();
                  setJumpWarningModal((prev) => ({ ...prev, isOpen: false }));
                  executeSaveSetoran({ alasanLompatanHalaman: alasan });
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs min-h-[38px] disabled:bg-slate-300"
              >
                {isSubmitting ? "Sedang menyimpan..." : "Tetap simpan dengan alasan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
