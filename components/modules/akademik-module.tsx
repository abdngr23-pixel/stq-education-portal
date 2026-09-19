"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Role } from "@/types/auth";
import { DashboardSantriSummary } from "./beranda-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { inputNilaiAction, getNilaiAkademikListAction } from "@/app/actions/akademik";
import {
  getNilaiKepesantrenanSantriAction,
} from "@/app/actions/kepesantrenan";
import { konversiPredikatNilai } from "@/lib/educational-rules";
import { PrintRapor } from "@/components/print/print-rapor";
import { JenisNilai } from "@prisma/client";
import {
  GraduationCap,
  Printer,
  CheckCircle2,
  AlertCircle,
  X,
  Filter,
  BookOpen,
  BookMarked,
  Check,
  Search,
  Calendar,
  Clock,
  Lock,
  FileText,
  Users,
} from "lucide-react";
import {
  resolveStudiUmumSchedule,
  CANONICAL_KEPESANTRENAN_SUBJECT_DEFINITIONS,
  KEPESANTRENAN_SCHEDULED_FACTS,
  isStudiUmumSubject,
  STUDI_UMUM_MAPEL_OPTIONS,
  MAPEL_OPTIONS,
  EducationSessionReadDTO,
  matchStudiUmumSession,
  matchKepesantrenanSession,
} from "@/lib/pendidikan-v2";
import { getTodayWITADateString } from "@/lib/wita-date";
import {
  getEducationSessionsAction,
  startEducationSessionAction,
  recordEducationSessionMaterialAction,
} from "@/app/actions/pendidikan-v2";

export { STUDI_UMUM_MAPEL_OPTIONS, MAPEL_OPTIONS };

export interface NilaiItem {
  id?: string;
  santriId?: string;
  santriNis?: string;
  santriNama?: string;
  mapel: string;
  kategori: string;
  angka: number;
  huruf: string;
  guru: string;
  jenisNilai?: string;
  semester?: number;
  tahunAjaran?: string;
}

export interface AkademikModuleProps {
  userRole: Role;
  currentUserName: string;
  santriList: DashboardSantriSummary[];
}

export const KEPESANTRENAN_INFO = [
  {
    kode: "KPS-ARB",
    nama: "Bahasa Arab",
    kitab: KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-ARB"].levels.TINGKAT_1.referenceBook,
    deskripsi: "Pendidikan Bahasa Arab berjenjang berdasarkan tingkat kemahiran pedagogis (Tingkat I, II, dan III).",
    guruPutra: `Tingkat I: ${KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-ARB"].levels.TINGKAT_1.teacherName} | Tingkat II: ${KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-ARB"].levels.TINGKAT_2.teacherName} | Tingkat III: ${KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-ARB"].levels.TINGKAT_3.teacherName}`,
    guruPutri: KEPESANTRENAN_SCHEDULED_FACTS.PUTRI["KPS-ARB"].teacherName,
    jadwal: "Senin, 18:30–19:30 WITA",
    guruDefault: "Berdasarkan Tingkat & Gender",
  },
  {
    kode: "KPS-FQH",
    nama: "Fikih",
    kitab: KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-FQH"].referenceBook,
    deskripsi: "Kaidah thaharah, shalat, dan adab ibadah praktis harian santri.",
    guruPutra: KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-FQH"].teacherName,
    guruPutri: KEPESANTRENAN_SCHEDULED_FACTS.PUTRI["KPS-FQH"].teacherName,
    jadwal: "Selasa, 18:30–19:30 WITA",
    guruDefault: `${KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-FQH"].teacherName} / ${KEPESANTRENAN_SCHEDULED_FACTS.PUTRI["KPS-FQH"].teacherName}`,
  },
  {
    kode: "KPS-TFS",
    nama: "Tafsir",
    kitab: KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-TFS"].referenceBooks.join(" & "),
    deskripsi: "Tadabbur ayat-ayat suci Al-Qur'an dan pemahaman pesan tauhid serta hukum syari'at.",
    guruPutra: KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-TFS"].teacherName,
    guruPutri: KEPESANTRENAN_SCHEDULED_FACTS.PUTRI["KPS-TFS"].teacherName,
    jadwal: "Rabu, 18:30–19:30 WITA",
    guruDefault: `${KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-TFS"].teacherName} / ${KEPESANTRENAN_SCHEDULED_FACTS.PUTRI["KPS-TFS"].teacherName}`,
  },
  {
    kode: "KPS-AQD",
    nama: "Aqidah",
    kitab: KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-AQD"].referenceBook,
    deskripsi: "Penanaman aqidah shahihah, rukun iman, dan tauhid ahlussunnah wal jama'ah.",
    guruPutra: KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-AQD"].teacherName,
    guruPutri: KEPESANTRENAN_SCHEDULED_FACTS.PUTRI["KPS-AQD"].teacherName,
    jadwal: "Kamis, 18:30–19:30 WITA",
    guruDefault: `${KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-AQD"].teacherName} / ${KEPESANTRENAN_SCHEDULED_FACTS.PUTRI["KPS-AQD"].teacherName}`,
  },
  {
    kode: "KPS-TJW",
    nama: "Tajwid",
    kitab: KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-TJW"].referenceBook,
    deskripsi: "Makharijul huruf, sifatul huruf, dan kaidah hukum tajwid praktis.",
    guruPutra: KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-TJW"].teacherName,
    guruPutri: KEPESANTRENAN_SCHEDULED_FACTS.PUTRI["KPS-TJW"].teacherName,
    jadwal: "Jumat, 18:30–19:30 WITA",
    guruDefault: `${KEPESANTRENAN_SCHEDULED_FACTS.PUTRA["KPS-TJW"].teacherName} / ${KEPESANTRENAN_SCHEDULED_FACTS.PUTRI["KPS-TJW"].teacherName}`,
  },
];

export function AkademikModule({
  userRole,
  currentUserName,
  santriList,
}: AkademikModuleProps) {
  const [subTab, setSubTab] = useState<"input_nilai" | "rapor" | "kepesantrenan">("input_nilai");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 1. Filter Wajib Sebelum Input Nilai (Tahap 6)
  const [selectedKelas, setSelectedKelas] = useState<string>("ALL");
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState<string>("2026/2027");
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [selectedMapelId, setSelectedMapelId] = useState<string>("MP-SU-01");
  const [selectedJenisNilai, setSelectedJenisNilai] = useState<JenisNilai>("TUGAS");

  // Filter Santri yang Aktif Dinilai - Mulai kosong, tidak default ke angka 90 atau santri sembarang
  const [selectedSantriNis, setSelectedSantriNis] = useState<string>(santriList[0]?.nis || "");
  const [inputNilaiAngka, setInputNilaiAngka] = useState<string>("");
  const [catatanNilai, setCatatanNilai] = useState<string>("");

  // Daftar Nilai Akademik Terverifikasi (Initial state bersih tanpa mock data)
  const [nilaiList, setNilaiList] = useState<NilaiItem[]>([]);
  const [isNilaiLoading, setIsNilaiLoading] = useState<boolean>(true);

  // Milestone 3.3B: Studi Umum Saturday Schedule & Session Management State
  const [selectedCohortStartYear, setSelectedCohortStartYear] = useState<number>(2026);
  const [selectedSemesterMeeting, setSelectedSemesterMeeting] = useState<number>(1);
  const [selectedOperationalDateWita, setSelectedOperationalDateWita] = useState<string>(() => getTodayWITADateString());
  const cohortLevel = (selectedCohortStartYear === 2026 ? 1 : selectedCohortStartYear === 2025 ? 2 : 3) as 1 | 2 | 3;

  // Milestone 3.3B & 3.3C1: Kepesantrenan Daily Schedule, Gender & Pedagogical Level State
  const [selectedKpsDay, setSelectedKpsDay] = useState<"Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday">("Monday");
  const [selectedKpsGender, setSelectedKpsGender] = useState<"PUTRA" | "PUTRI">("PUTRA");
  const [selectedKpsArabLevel, setSelectedKpsArabLevel] = useState<"TINGKAT_1" | "TINGKAT_2" | "TINGKAT_3">("TINGKAT_1");
  const [selectedKpsDateWita, setSelectedKpsDateWita] = useState<string>(() => getTodayWITADateString());

  // Milestone 3.3C1: Server-Authoritative Education Sessions State
  type ServerSessionStatus = "LOADING" | "READY" | "NOT_ENABLED" | "SCHEMA_NOT_READY" | "PERMISSION_DENIED" | "ERROR";
  const [serverSessions, setServerSessions] = useState<EducationSessionReadDTO[]>([]);
  const [serverSessionStatus, setServerSessionStatus] = useState<ServerSessionStatus>("LOADING");
  const [inputMateriText, setInputMateriText] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    getEducationSessionsAction()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setServerSessions(res.data);
          setServerSessionStatus("READY");
        } else {
          const err = res.error || "Gagal memuat data sesi pembelajaran";
          if (err.includes("NOT_ENABLED") || err.includes("UAT_NOT_ENABLED")) {
            setServerSessionStatus("NOT_ENABLED");
          } else if (err.includes("SCHEMA_NOT_READY")) {
            setServerSessionStatus("SCHEMA_NOT_READY");
          } else if (err.includes("UNAUTHORIZED") || err.includes("PERMISSION_DENIED")) {
            setServerSessionStatus("PERMISSION_DENIED");
          } else {
            setServerSessionStatus("ERROR");
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setServerSessionStatus("ERROR");
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartSession = async (sessionId: string) => {
    startTransition(async () => {
      const res = await startEducationSessionAction({ sessionId });
      if (res.success) {
        setFeedback({ type: "success", message: res.message || "Sesi pembelajaran berhasil dimulai." });
        const refetch = await getEducationSessionsAction();
        if (refetch.success && refetch.data) setServerSessions(refetch.data);
      } else {
        setFeedback({ type: "error", message: res.error || res.message || "Gagal memulai sesi." });
      }
    });
  };

  const handleRecordMaterial = async (sessionId: string) => {
    if (!inputMateriText.trim()) return;
    startTransition(async () => {
      const res = await recordEducationSessionMaterialAction({ sessionId, materi: inputMateriText.trim() });
      if (res.success) {
        setFeedback({ type: "success", message: res.message || "Materi pembelajaran berhasil disimpan." });
        setInputMateriText("");
        const refetch = await getEducationSessionsAction();
        if (refetch.success && refetch.data) setServerSessions(refetch.data);
      } else {
        setFeedback({ type: "error", message: res.error || res.message || "Gagal menyimpan materi." });
      }
    });
  };

  // Load data nilai riil dari server action on mount
  useEffect(() => {
    let isMounted = true;
    getNilaiAkademikListAction()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data && res.data.length > 0) {
          setNilaiList(
            res.data.map((item) => ({
              id: item.id,
              santriId: item.santriId,
              santriNis: item.santriNis,
              santriNama: item.santriNama,
              mapel: item.mapelNama,
              kategori: item.mapelKategori,
              angka: item.angka,
              huruf: item.huruf,
              guru: item.guruNama,
              jenisNilai: item.jenis,
              semester: item.semester,
              tahunAjaran: item.tahunAjaran,
            }))
          );
        } else {
          setNilaiList([]);
        }
      })
      .catch(() => {
        if (isMounted) setNilaiList([]);
      })
      .finally(() => {
        if (isMounted) setIsNilaiLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter kelas untuk santri
  const filteredSantriOptions = selectedKelas === "ALL"
    ? santriList
    : santriList.filter((s) => s.kelas.includes(selectedKelas));

  // Handler ganti filter kelas: langsung sinkronkan pilihan santri secara deterministik
  const handleKelasChange = (newKelas: string) => {
    setSelectedKelas(newKelas);
    const newOptions = newKelas === "ALL"
      ? santriList
      : santriList.filter((s) => s.kelas.includes(newKelas));
    if (!newOptions.some((s) => s.nis === selectedSantriNis)) {
      setSelectedSantriNis(newOptions[0]?.nis || "");
    }
  };

  // Santri Terpilih (tanpa fallback berbahaya ke santriList[0] jika tidak sesuai)
  const currentSantri = santriList.find((s) => s.nis === selectedSantriNis);
  const currentMapel =
    STUDI_UMUM_MAPEL_OPTIONS.find((m) => m.id === selectedMapelId) || STUDI_UMUM_MAPEL_OPTIONS[0];

  // Nilai untuk santri terpilih pada rapor
  const santriNilaiForRapor = currentSantri
    ? nilaiList.filter((n) => n.santriNis === currentSantri.nis)
    : [];

  // Modal Cetak Rapor
  const [showPrintRaporModal, setShowPrintRaporModal] = useState(false);

  // Handler Simpan Nilai
  const handleSaveNilai = () => {
    setFeedback(null);
    if (!["GA", "KS", "ADM"].includes(userRole)) {
      setFeedback({ type: "error", message: `Role '${userRole}' tidak berwenang menginput nilai akademik.` });
      return;
    }
    if (!currentSantri) {
      setFeedback({ type: "error", message: "Silakan pilih santri terlebih dahulu dari kelas yang sesuai." });
      return;
    }

    // Defense-in-depth: Ensure mapel is strictly a Studi Umum subject
    if (!currentMapel || !isStudiUmumSubject(currentMapel.nama) || !isStudiUmumSubject(selectedMapelId)) {
      setFeedback({
        type: "error",
        message: "KEPESANTRENAN_ASSESSMENT_DEFERRED: Penilaian untuk mata pelajaran Kepesantrenan belum diaktifkan. Format penilaian resmi masih ditangguhkan.",
      });
      return;
    }

    if (!inputNilaiAngka.trim()) {
      setFeedback({ type: "error", message: "Nilai angka wajib diisi sebelum menyimpan." });
      return;
    }

    const angkaNum = parseFloat(inputNilaiAngka);
    if (isNaN(angkaNum) || angkaNum < 0 || angkaNum > 100) {
      setFeedback({ type: "error", message: "Nilai harus berupa angka antara 0 sampai 100." });
      return;
    }

    startTransition(async () => {
      const res = await inputNilaiAction({
        santriId: currentSantri.id,
        mapelId: selectedMapelId,
        semester: selectedSemester,
        tahunAjaran: selectedTahunAjaran,
        jenis: selectedJenisNilai,
        angka: angkaNum,
        catatan: catatanNilai,
      });

      if (res.success) {
        const huruf = konversiPredikatNilai(angkaNum);
        setNilaiList((prev) => [
          {
            santriId: currentSantri.id,
            santriNis: currentSantri.nis,
            santriNama: currentSantri.nama,
            mapel: currentMapel.nama,
            kategori: currentMapel.kategori,
            angka: angkaNum,
            huruf,
            guru: currentUserName || currentMapel.guru,
            jenisNilai: selectedJenisNilai,
            semester: selectedSemester,
            tahunAjaran: selectedTahunAjaran,
          },
          ...prev.filter(
            (n) => !(n.santriNis === currentSantri.nis && n.mapel === currentMapel.nama && n.jenisNilai === selectedJenisNilai)
          ),
        ]);

        setFeedback({
          type: "success",
          message: `Nilai ${currentMapel.nama} untuk ${currentSantri.nama} (${angkaNum} - Predikat ${huruf}) berhasil disimpan.`,
        });
        setInputNilaiAngka("");
        setCatatanNilai("");
      } else {
        setFeedback({ type: "error", message: res.message || "Gagal menyimpan nilai akademik." });
      }
    });
  };

  // Kepesantrenan States
  const [selectedKpsKode, setSelectedKpsKode] = useState<string>("KPS-ARB");
  const [kpsNilaiList, setKpsNilaiList] = useState<
    Array<{
      id: string;
      santriNama: string;
      santriNis: string;
      santriKelas: string;
      mapelNama: string;
      kodeMapel: string;
      guruNama: string;
      jenis: string;
      angka: number;
      huruf: string;
      catatan?: string | null;
      createdAt: string;
    }>
  >([]);
  const [kpsSearch, setKpsSearch] = useState<string>("");

  // Load nilai kepesantrenan dari DB untuk kebutuhan historis
  useEffect(() => {
    let isMounted = true;

    getNilaiKepesantrenanSantriAction({}).then((res) => {
      if (isMounted && res.success && res.data) {
        setKpsNilaiList(res.data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);


  return (
    <div className="space-y-6">
      {/* Sub-Navigasi: Input Nilai vs Rapor Santri */}
      <div className="p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            type="button"
            data-testid="subtab-input_nilai"
            onClick={() => setSubTab("input_nilai")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 min-h-[44px] shrink-0 ${
              subTab === "input_nilai"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Studi Umum
          </button>
          <button
            type="button"
            data-testid="subtab-kepesantrenan"
            onClick={() => setSubTab("kepesantrenan")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 min-h-[44px] shrink-0 ${
              subTab === "kepesantrenan"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Kepesantrenan
          </button>
          <button
            type="button"
            data-testid="subtab-rapor"
            onClick={() => setSubTab("rapor")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 min-h-[44px] shrink-0 ${
              subTab === "rapor"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <Printer className="h-4 w-4" />
            Pratinjau &amp; Cetak Rapor
          </button>
        </div>
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

      {/* 1. VIEW INPUT PENILAIAN AKADEMIK */}
      {subTab === "input_nilai" && (
        <div className="space-y-5">
          {/* Milestone 3.3B: Studi Umum Saturday Schedule & Session Management */}
          <Card rounded="3xl" className="border border-emerald-200/80 shadow-xs bg-gradient-to-b from-emerald-50/50 via-white to-white">
            <CardHeader className="pb-3 border-b border-emerald-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[#0E7C3A]" />
                    Jadwal KBM Studi Umum — Hari Sabtu
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    KBM Terstruktur 3 JP (@110 menit: 08:00–09:50, 10:00–11:50, 13:30–15:20 WITA) berbasis Rotasi PBL 20 Pertemuan. (Alur presensi santri Studi Umum ditangguhkan pada M3.3B).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="green" size="sm" className="font-bold">
                    TA 2026/2027
                  </Badge>
                  <Badge variant="neutral" size="sm" className="font-bold">
                    Sabtu (WITA)
                  </Badge>
                </div>
              </div>

              {/* Selector Angkatan/Tingkat, Pertemuan Semester & Tanggal Operasional */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                    Pilih Angkatan Program (Tingkat KBM)
                  </label>
                  <select
                    value={selectedCohortStartYear}
                    onChange={(e) => setSelectedCohortStartYear(parseInt(e.target.value, 10))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800"
                  >
                    <option value={2026}>Angkatan 2026/2027 → Tingkat 1 (Kelas Awal)</option>
                    <option value={2025}>Angkatan 2025/2026 → Tingkat 2 (Kelas Menengah)</option>
                    <option value={2024}>Angkatan 2024/2025 → Tingkat 3 (Kelas Akhir)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                    Nomor Pertemuan Semester (1 s/d 20)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={selectedSemesterMeeting}
                      onChange={(e) => setSelectedSemesterMeeting(parseInt(e.target.value, 10))}
                      className="flex-1 accent-[#0E7C3A] cursor-pointer"
                    />
                    <span className="px-3 py-2 rounded-xl bg-emerald-100 text-emerald-900 font-bold text-xs shrink-0 min-w-[70px] text-center">
                      Pertemuan {selectedSemesterMeeting}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                    Tanggal Operasional (Sabtu WITA)
                  </label>
                  <input
                    type="date"
                    value={selectedOperationalDateWita}
                    onChange={(e) => setSelectedOperationalDateWita(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* 3 JP Slot Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((jpNum) => {
                  const schedule = resolveStudiUmumSchedule({
                    programLevel: cohortLevel,
                    jp: jpNum,
                    semesterMeetingNumber: selectedSemesterMeeting,
                  });

                  const suSession = matchStudiUmumSession(serverSessions, {
                    scheduledDate: selectedOperationalDateWita,
                    subjectName: schedule.subject,
                    jp: schedule.jp,
                    semesterMeetingNumber: selectedSemesterMeeting,
                    programLevel: cohortLevel,
                  });

                  return (
                    <div
                      key={jpNum}
                      className="p-4 rounded-2xl border transition-all flex flex-col justify-between bg-white border-slate-200"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-black">
                            JP {jpNum}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {schedule.timeSlot}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-slate-900 font-heading">
                              {schedule.subject}
                            </h4>
                            <Badge
                              variant={schedule.type === "CORE" ? "green" : "sky"}
                              size="sm"
                              className="font-bold uppercase tracking-wider text-[10px]"
                            >
                              {schedule.type}
                            </Badge>
                          </div>
                          {schedule.type === "PBL" && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="text-slate-600 font-medium">
                                Blok {schedule.pblBlockNumber} • Minggu {schedule.pblWeekInBlock}/5
                              </span>
                              <Badge
                                variant={schedule.isProjectWeek ? "orange" : "neutral"}
                                size="sm"
                                className="font-semibold text-[10px]"
                              >
                                {schedule.pblPhase === "PROJECT" ? "★ PEKAN PROYEK" : "TEORI"}
                              </Badge>
                            </div>
                          )}
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Guru Pengajar:</span>
                            <span className="font-semibold text-slate-600">
                              {suSession?.actualTeacherDisplay || suSession?.scheduledTeacherDisplay || "Belum diaktifkan"}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Status Sesi:</span>
                            {(() => {
                              if (serverSessionStatus === "LOADING") {
                                return <span className="font-bold text-slate-500">○ MEMUAT...</span>;
                              }
                              if (serverSessionStatus === "NOT_ENABLED") {
                                return <span className="font-bold text-amber-700">○ UAT NONAKTIF</span>;
                              }
                              if (serverSessionStatus === "SCHEMA_NOT_READY") {
                                return <span className="font-bold text-amber-700">○ SKEMA BELUM SIAP</span>;
                              }
                              if (serverSessionStatus === "PERMISSION_DENIED") {
                                return <span className="font-bold text-red-600">○ AKSES DITOLAK</span>;
                              }
                              if (serverSessionStatus === "ERROR") {
                                return <span className="font-bold text-red-600">○ GAGAL MEMUAT</span>;
                              }
                              if (suSession) {
                                if (suSession.status === "STARTED") {
                                  return <span className="font-bold text-emerald-700">● BERLANGSUNG</span>;
                                }
                                if (suSession.status === "COMPLETED") {
                                  return <span className="font-bold text-blue-700">✔ SELESAI</span>;
                                }
                                return <span className="font-bold text-amber-700">○ TERJADWAL</span>;
                              }
                              return <span className="font-bold text-slate-400">○ BELUM ADA DI SERVER</span>;
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100">
                        {(() => {
                          if (serverSessionStatus === "READY" && suSession && suSession.mutationAvailable) {
                            return (
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => handleStartSession(suSession.sessionId)}
                                className="w-full min-h-[44px] bg-[#0E7C3A] hover:bg-[#0B642E] text-white text-xs font-bold gap-1.5"
                              >
                                Mulai Pembelajaran
                              </Button>
                            );
                          }

                          let notice = "Belum diaktifkan — menunggu aktivasi M3.3C";
                          if (serverSessionStatus === "LOADING") {
                            notice = "Memuat status sesi dari server...";
                          } else if (serverSessionStatus === "NOT_ENABLED") {
                            notice = "UAT belum aktif (PENDIDIKAN_V2_UAT_ENABLED=false)";
                          } else if (serverSessionStatus === "SCHEMA_NOT_READY") {
                            notice = "Skema database belum siap";
                          } else if (serverSessionStatus === "PERMISSION_DENIED") {
                            notice = "Akses tidak diotorisasi";
                          } else if (suSession?.mutationDeniedReason === "AUTHENTICATION_REQUIRED") {
                            notice = "Harap masuk (login) untuk mengelola sesi";
                          } else if (suSession?.mutationDeniedReason === "SCHEDULED_TEACHER_NOT_RESOLVED") {
                            notice = "Guru terjadwal belum terdaftar di sesi";
                          } else if (suSession?.mutationDeniedReason === "STAFF_NOT_LINKED") {
                            notice = "Profil pendidik staf belum terhubung";
                          } else if (suSession?.mutationDeniedReason === "SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED") {
                            notice = "Bukan guru terjadwal — kebijakan badal belum aktif";
                          } else if (suSession?.mutationDeniedReason === "CANONICAL_AUTH_DENIED") {
                            notice = "Wewenang mengajar tidak mencukupi";
                          }

                          return (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled
                              className="w-full min-h-[44px] bg-slate-100 text-slate-400 cursor-not-allowed text-xs font-bold gap-1.5 border border-slate-200"
                            >
                              <Lock className="h-4 w-4 text-slate-400" />
                              {notice}
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Panel Pra-Filter (Point 6: Wajib pilih parameter sebelum input) */}
          <Card rounded="3xl" className="border border-slate-200 shadow-xs bg-white">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm sm:text-base font-bold text-slate-900 font-heading flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#0E7C3A]" />
                Parameter Penilaian Kurikulum
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Pilih kelas, tahun ajaran, semester, mata pelajaran, dan jenis evaluasi sebelum input nilai.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Filter Kelas */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                    Pilih Kelas
                  </label>
                  <select
                    value={selectedKelas}
                    onChange={(e) => handleKelasChange(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                  >
                    <option value="ALL">Semua Kelas</option>
                    <option value="7">Kelas 7</option>
                    <option value="8">Kelas 8</option>
                    <option value="9">Kelas 9</option>
                  </select>
                </div>

                {/* 2. Tahun Ajaran */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                    Tahun Ajaran
                  </label>
                  <select
                    value={selectedTahunAjaran}
                    onChange={(e) => setSelectedTahunAjaran(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                  >
                    <option value="2026/2027">2026/2027</option>
                    <option value="2025/2026">2025/2026</option>
                  </select>
                </div>

                {/* 3. Semester */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                    Semester
                  </label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(parseInt(e.target.value) || 1)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                  >
                    <option value={1}>Semester 1 (Ganjil)</option>
                    <option value={2}>Semester 2 (Genap)</option>
                  </select>
                </div>

                {/* 4. Mata Pelajaran */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                    Mata Pelajaran
                  </label>
                  <select
                    value={selectedMapelId}
                    onChange={(e) => setSelectedMapelId(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                  >
                    {STUDI_UMUM_MAPEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Jenis Evaluasi */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                    Jenis Penilaian
                  </label>
                  <select
                    value={selectedJenisNilai}
                    onChange={(e) => setSelectedJenisNilai(e.target.value as JenisNilai)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                  >
                    <option value="TUGAS">Tugas & Ulangan Harian</option>
                    <option value="UTS">Ujian Tengah Semester (UTS)</option>
                    <option value="UAS">Ujian Akhir Semester (UAS)</option>
                    <option value="PBL">Project-Based Learning (PBL)</option>
                    <option value="KEAKTIFAN">Keaktifan / Adab Belajar</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form & Tabel Penilaian */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Input Santri */}
            <div className="lg:col-span-1">
              <Card rounded="3xl" className="border border-slate-200 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-base font-bold text-slate-900 font-heading">
                    Input Nilai Santri
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Mapel: <strong>{currentMapel.nama}</strong> ({currentMapel.kategori})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Pilih Santri
                    </label>
                    <select
                      value={selectedSantriNis}
                      onChange={(e) => setSelectedSantriNis(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900"
                    >
                      {filteredSantriOptions.map((s) => (
                        <option key={s.nis} value={s.nis}>
                          {s.nama} ({s.nis} - {s.kelas})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Nilai Angka (0 - 100)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={inputNilaiAngka}
                      onChange={(e) => setInputNilaiAngka(e.target.value)}
                      className="min-h-[44px] text-base font-bold"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Konversi Predikat Otomatis:{" "}
                      <strong className="text-emerald-700 font-bold">
                        {konversiPredikatNilai(parseFloat(inputNilaiAngka) || 0)}
                      </strong>{" "}
                      (A: ≥90, B: ≥80, C: ≥70, D: &lt;70)
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Catatan Guru Pengajar (Opsional)
                    </label>
                    <textarea
                      rows={3}
                      value={catatanNilai}
                      onChange={(e) => setCatatanNilai(e.target.value)}
                      placeholder="Contoh: Pemahaman mufrodat & kaidah nahwu sangat mendalam..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800"
                    />
                  </div>

                  {/* Konteks Penilaian Lengkap Sebelum Simpan */}
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl text-xs space-y-1.5 text-emerald-950">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-emerald-800">Target Evaluasi:</span>
                      <Badge variant="green" size="sm" className="font-bold uppercase tracking-wider">
                        {selectedJenisNilai}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-700">
                      <div>
                        <span className="text-slate-500 block">Santri:</span>
                        <strong className="text-slate-900 line-clamp-1">{currentSantri ? currentSantri.nama : "Belum dipilih"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Kelas:</span>
                        <strong className="text-slate-900">{currentSantri ? currentSantri.kelas : "-"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Mata Pelajaran:</span>
                        <strong className="text-slate-900 line-clamp-1">{currentMapel.nama}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Periode:</span>
                        <strong className="text-slate-900">Sem {selectedSemester} • {selectedTahunAjaran}</strong>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleSaveNilai}
                    disabled={isPending || !currentSantri}
                    className="w-full min-h-[48px] font-bold text-sm bg-[#0E7C3A] hover:bg-[#0B642E]"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    {isPending ? "Menyimpan..." : "Simpan Nilai Santri"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Tabel Riwayat Nilai Mapel Ini */}
            <div className="lg:col-span-2">
              <Card rounded="3xl" className="border border-slate-200 shadow-xs overflow-hidden">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 font-heading">
                      Daftar Nilai: {currentMapel.nama}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Tahun Ajaran {selectedTahunAjaran} • Semester {selectedSemester}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <th className="px-4 py-3">Nama Santri</th>
                        <th className="px-3 py-3">Mata Pelajaran</th>
                        <th className="px-3 py-3 text-center">Nilai Angka</th>
                        <th className="px-3 py-3 text-center">Predikat</th>
                        <th className="px-4 py-3">Pengajar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isNilaiLoading ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-slate-500 text-xs">
                            Memuat data nilai...
                          </td>
                        </tr>
                      ) : nilaiList.filter((n) => n.mapel === currentMapel.nama).length > 0 ? (
                        nilaiList
                          .filter((n) => n.mapel === currentMapel.nama)
                          .map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                {item.santriNama || currentSantri?.nama || "-"}
                                <span className="block text-[11px] text-slate-500 font-normal">
                                  {item.santriNis || currentSantri?.nis || "-"}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-slate-700">
                                {item.mapel}
                                <span className="block text-[10px] text-slate-500">{item.kategori}</span>
                              </td>
                              <td className="px-3 py-3 text-center font-extrabold text-slate-900 text-sm">
                                {item.angka}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <Badge
                                  variant={
                                    item.huruf === "A"
                                      ? "green"
                                      : item.huruf === "B"
                                      ? "sky"
                                      : item.huruf === "C"
                                      ? "orange"
                                      : "ditolak"
                                  }
                                  size="sm"
                                  className="font-bold text-xs"
                                >
                                  {item.huruf}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-slate-700 font-medium">
                                {item.guru}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-slate-500 text-xs">
                            Belum ada nilai yang dicatat untuk mata pelajaran ini pada periode berjalan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* 2. VIEW PRATINJAU & CETAK RAPOR SANTRI */}
      {subTab === "rapor" && (
        <div className="space-y-4">
          <Card rounded="3xl" className="border border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 font-heading">
                  Rapor Hasil Evaluasi Belajar Santri
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Data nilai terverifikasi tanpa nilai estimasi palsu.
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <select
                  data-testid="select-santri-rapor"
                  value={selectedSantriNis}
                  onChange={(e) => setSelectedSantriNis(e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 w-full sm:w-auto focus:bg-white focus:ring-2 focus:ring-[#0E7C3A]/20 transition-colors"
                >
                  <option value="">-- Pilih Santri --</option>
                  {santriList.map((s) => (
                    <option key={s.nis} value={s.nis}>
                      {s.nama} ({s.kelas})
                    </option>
                  ))}
                </select>
                <Button
                  data-testid="btn-cetak-rapor-modal"
                  variant="primary"
                  size="sm"
                  disabled={!currentSantri}
                  onClick={() => setShowPrintRaporModal(true)}
                  className="bg-[#0E7C3A] hover:bg-[#0B642E] text-xs font-bold gap-1.5 min-h-[44px] disabled:opacity-50 w-full sm:w-auto justify-center"
                >
                  <Printer className="h-4 w-4" />
                  Cetak Rapor A4
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              {currentSantri ? (
                <>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row justify-between gap-3 text-xs sm:text-sm">
                    <div>
                      <p className="text-slate-500 font-medium">Nama Santri:</p>
                      <strong className="text-base text-slate-900 font-heading">{currentSantri.nama}</strong>
                      <p className="text-slate-600 mt-1">NIS: {currentSantri.nis} • Kelas: {currentSantri.kelas}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-slate-500 font-medium">Tahun Ajaran / Semester:</p>
                      <strong className="text-slate-900">{selectedTahunAjaran} • Semester {selectedSemester}</strong>
                      <p className="text-slate-600 mt-1">Capaian Tahfizh: {currentSantri.capaianJuz} Juz</p>
                    </div>
                  </div>

                  {/* Desktop View: Tabel Nilai Rapor (hidden on mobile, full width on md+) */}
                  <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-xs sm:text-sm text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="px-4 py-3">Mata Pelajaran</th>
                          <th className="px-3 py-3">Kelompok Kurikulum</th>
                          <th className="px-3 py-3 text-center">Nilai Angka</th>
                          <th className="px-3 py-3 text-center">Predikat</th>
                          <th className="px-4 py-3">Guru Pengampu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isNilaiLoading ? (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-slate-500 text-xs">
                              Memuat data nilai akademik santri...
                            </td>
                          </tr>
                        ) : santriNilaiForRapor.length > 0 ? (
                          santriNilaiForRapor.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-900">{item.mapel}</td>
                              <td className="px-3 py-3 text-slate-600">{item.kategori}</td>
                              <td className="px-3 py-3 text-center font-extrabold text-slate-900">{item.angka}</td>
                              <td className="px-3 py-3 text-center">
                                <Badge
                                  variant={item.huruf === "A" ? "green" : item.huruf === "B" ? "sky" : "orange"}
                                  size="sm"
                                  className="font-bold"
                                >
                                  {item.huruf}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{item.guru}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-slate-500 text-xs">
                              Belum ada data nilai akademik yang dicatat untuk santri ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View: Stacked Semantic Rows per Mata Pelajaran (Clean & Operational, Zero Clipping) */}
                  <div className="block md:hidden divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    {isNilaiLoading ? (
                      <div className="text-center py-10 px-4 text-slate-500 text-xs font-medium">
                        Memuat data nilai akademik santri...
                      </div>
                    ) : santriNilaiForRapor.length > 0 ? (
                      santriNilaiForRapor.map((item, idx) => (
                        <div key={idx} className="p-3.5 space-y-2 hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                                {item.mapel}
                              </h4>
                              <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
                                {item.kategori}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-base font-bold text-slate-900 font-heading">
                                {item.angka}
                              </span>
                              <Badge
                                variant={item.huruf === "A" ? "green" : item.huruf === "B" ? "sky" : "orange"}
                                size="sm"
                                className="font-bold text-xs px-2 py-0.5"
                              >
                                {item.huruf}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>Guru Pengampu:</span>
                            <span className="font-semibold text-slate-700 truncate max-w-[200px]">{item.guru}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 px-4 text-slate-500 text-xs font-medium">
                        Belum ada data nilai akademik yang dicatat untuk santri ini.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500 text-sm font-medium">
                  Silakan pilih santri terlebih dahulu untuk melihat pratinjau rapor.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. VIEW KURIKULUM & EVALUASI KEPESANTRENAN */}
      {subTab === "kepesantrenan" && (
        <div className="space-y-6">
          {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 p-4 sm:p-5 rounded-3xl border border-emerald-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-[#0E7C3A] text-white shadow-xs">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                        5 Mata Pelajaran Kepesantrenan Resmi
                      </h3>
                      <p className="text-xs text-slate-500">
                        Standarisasi kurikulum ma&apos;had berasas kitab turats, tajwid bersanad, dan aqidah salafus shalih.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="green" size="md" className="font-bold">
                    Otorisasi: {userRole}
                  </Badge>
                  <Badge variant="sky" size="md" className="font-bold">
                    5 Mapel Wajib
                  </Badge>
                </div>
              </div>

              {/* 5 Subject Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {KEPESANTRENAN_INFO.map((kps) => {
                  const isSelected = selectedKpsKode === kps.kode;
                  return (
                    <div
                      key={kps.kode}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? "bg-white border-[#0E7C3A] shadow-md ring-2 ring-[#0E7C3A]/20"
                          : "bg-white/80 border-slate-200 hover:border-slate-300 hover:shadow-xs"
                      }`}
                      onClick={() => setSelectedKpsKode(kps.kode)}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <Badge
                            variant={isSelected ? "green" : "neutral"}
                            size="sm"
                            className="font-mono font-bold"
                          >
                            {kps.kode}
                          </Badge>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-[#0E7C3A]">
                              <Check className="h-3.5 w-3.5" /> Dipilih
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{kps.nama}</h4>
                        <div className="mt-2 text-xs">
                          <p className="text-slate-500 text-[11px] font-semibold">Kitab Rujukan:</p>
                          <p className="font-medium text-slate-800 italic">
                            {kps.kitab || "Menunggu penetapan kurikulum"}
                          </p>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                          {kps.deskripsi}
                        </p>
                      </div>
                      <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Pengampu:</span>
                        <span className="font-semibold text-slate-700">{kps.guruDefault}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Milestone 3.3B: Sesi Pembelajaran, Gating Materi & Presensi Kepesantrenan */}
              <Card rounded="3xl" className="border border-emerald-200 shadow-xs bg-white">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm sm:text-base font-bold text-slate-900 font-heading flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#0E7C3A]" />
                        Jadwal &amp; Sesi KBM Kepesantrenan (Senin–Jumat)
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Waktu KBM terencana: 18:30–19:30 WITA (ba&apos;da Maghrib). Materi dan presensi santri terkunci hingga guru mengklik &quot;Mulai Pembelajaran&quot;.
                      </CardDescription>
                    </div>
                    {/* Day Tabs & Gender Selector */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Gender Selector */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setSelectedKpsGender("PUTRA")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            selectedKpsGender === "PUTRA"
                              ? "bg-[#0E7C3A] text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Putra
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedKpsGender("PUTRI")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            selectedKpsGender === "PUTRI"
                              ? "bg-[#0E7C3A] text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Putri
                        </button>
                      </div>

                      {/* Tanggal WITA Selector */}
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        <span className="text-[11px] font-bold text-slate-500 pl-1.5 shrink-0 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" /> Tanggal:
                        </span>
                        <input
                          type="date"
                          value={selectedKpsDateWita}
                          onChange={(e) => setSelectedKpsDateWita(e.target.value)}
                          className="px-2 py-0.5 text-xs font-semibold bg-white rounded-lg border border-slate-200 text-slate-700 outline-none focus:ring-1 focus:ring-[#0E7C3A]"
                        />
                      </div>

                      {/* Day Tabs */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        {[
                          { day: "Monday", label: "Senin", mapel: "Bahasa Arab" },
                          { day: "Tuesday", label: "Selasa", mapel: "Fikih" },
                          { day: "Wednesday", label: "Rabu", mapel: "Tafsir" },
                          { day: "Thursday", label: "Kamis", mapel: "Aqidah" },
                          { day: "Friday", label: "Jumat", mapel: "Tajwid" },
                        ].map((d) => (
                          <button
                            key={d.day}
                            type="button"
                            onClick={() => setSelectedKpsDay(d.day as "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                              selectedKpsDay === d.day
                                ? "bg-[#0E7C3A] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Monday Arabic Level Selector for Putra */}
                  {selectedKpsGender === "PUTRA" && selectedKpsDay === "Monday" && (
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 bg-amber-50/70 p-2 rounded-xl">
                      <span className="text-[11px] font-bold text-amber-900 shrink-0">Tingkat Bahasa Arab Putra:</span>
                      {[
                        { level: "TINGKAT_1" as const, label: "Tingkat I (Ust. Abi Hudzaifah)" },
                        { level: "TINGKAT_2" as const, label: "Tingkat II (Ust. Kamal Mukhtar)" },
                        { level: "TINGKAT_3" as const, label: "Tingkat III (Ust. Andi Quarzy Ayatullah)" },
                      ].map((t) => (
                        <button
                          key={t.level}
                          type="button"
                          onClick={() => setSelectedKpsArabLevel(t.level)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            selectedKpsArabLevel === t.level
                              ? "bg-amber-700 text-white shadow-xs"
                              : "text-amber-800 hover:text-amber-950 bg-white/70"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-5">
                  {(() => {
                    const dayDef = CANONICAL_KEPESANTRENAN_SUBJECT_DEFINITIONS.find(
                      (s) => s.dayOfWeek === selectedKpsDay
                    );
                    const kpsFact = KEPESANTRENAN_INFO.find(
                      (k) => k.nama === dayDef?.name
                    );

                    const kpsSession = matchKepesantrenanSession(serverSessions, {
                      scheduledDate: selectedKpsDateWita,
                      subjectName: dayDef?.name,
                      genderGroup: selectedKpsGender,
                      pedagogicalLevel: (selectedKpsGender === "PUTRA" && dayDef?.code === "KPS-ARB") ? selectedKpsArabLevel : undefined,
                    });

                    const expectedTeacher = selectedKpsGender === "PUTRI"
                      ? "Ustazah Lisa Dwina Fitri"
                      : (dayDef?.code === "KPS-ARB"
                        ? (selectedKpsArabLevel === "TINGKAT_1" ? "Ust. Abi Hudzaifah" : selectedKpsArabLevel === "TINGKAT_2" ? "Ust. Kamal Mukhtar" : "Ust. Andi Quarzy Ayatullah")
                        : (kpsFact?.guruDefault || "Berdasarkan Jadwal Resmi"));

                    const displayTeacher = kpsSession?.actualTeacherDisplay || kpsSession?.scheduledTeacherDisplay || expectedTeacher;

                    const statusText = (() => {
                      if (serverSessionStatus === "LOADING") return "Memuat...";
                      if (serverSessionStatus === "NOT_ENABLED") return "UAT Nonaktif";
                      if (serverSessionStatus === "SCHEMA_NOT_READY") return "Skema Belum Siap";
                      if (serverSessionStatus === "PERMISSION_DENIED") return "Akses Ditolak";
                      if (serverSessionStatus === "ERROR") return "Gagal Memuat";
                      if (!kpsSession) return "Belum Ada Sesi";
                      if (kpsSession.status === "STARTED") return "Sedang Berlangsung";
                      if (kpsSession.status === "COMPLETED") return "Selesai";
                      return "Terjadwal";
                    })();

                    return (
                      <div className="space-y-4">
                        {/* Session Status Banner */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {dayDef?.dayNameId}: {dayDef?.name} ({selectedKpsGender === "PUTRA" ? "Santri Putra" : "Santri Putri"})
                              </span>
                              {(() => {
                                if (serverSessionStatus === "LOADING") {
                                  return <Badge variant="neutral" size="sm" className="font-bold">○ MEMUAT</Badge>;
                                }
                                if (serverSessionStatus === "NOT_ENABLED") {
                                  return <Badge variant="neutral" size="sm" className="font-bold">⚠ UAT NONAKTIF</Badge>;
                                }
                                if (serverSessionStatus === "SCHEMA_NOT_READY") {
                                  return <Badge variant="ditolak" size="sm" className="font-bold">⚠ SKEMA BELUM SIAP</Badge>;
                                }
                                if (serverSessionStatus === "PERMISSION_DENIED") {
                                  return <Badge variant="orange" size="sm" className="font-bold">⛔ AKSES DITOLAK</Badge>;
                                }
                                if (serverSessionStatus === "ERROR") {
                                  return <Badge variant="ditolak" size="sm" className="font-bold">✖ GAGAL MEMUAT</Badge>;
                                }
                                if (!kpsSession) {
                                  return <Badge variant="neutral" size="sm" className="font-bold">○ BELUM ADA SESI</Badge>;
                                }
                                if (kpsSession.status === "STARTED") {
                                  return <Badge variant="green" size="sm" className="font-bold">● BERLANGSUNG</Badge>;
                                }
                                if (kpsSession.status === "COMPLETED") {
                                  return <Badge variant="sky" size="sm" className="font-bold">✔ SELESAI</Badge>;
                                }
                                if (kpsSession.status === "SCHEDULED") {
                                  return <Badge variant="neutral" size="sm" className="font-bold">○ TERJADWAL</Badge>;
                                }
                                return <Badge variant="neutral" size="sm" className="font-bold">○ BELUM ADA SESI</Badge>;
                              })()}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Jendela Waktu: {dayDef?.scheduledWindowWita} • Tanggal: {selectedKpsDateWita} • Guru Terjadwal: {displayTeacher} • Status: {statusText}
                            </p>
                          </div>

                          <div>
                            {(() => {
                              if (serverSessionStatus === "READY" && kpsSession && kpsSession.mutationAvailable) {
                                return (
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleStartSession(kpsSession.sessionId)}
                                    className="min-h-[44px] bg-[#0E7C3A] hover:bg-[#0B642E] text-white text-xs font-bold gap-1.5"
                                  >
                                    Mulai Pembelajaran
                                  </Button>
                                );
                              }

                              let notice = "Belum diaktifkan — menunggu aktivasi M3.3C";
                              if (serverSessionStatus === "LOADING") {
                                notice = "Memuat status sesi...";
                              } else if (serverSessionStatus === "NOT_ENABLED") {
                                notice = "UAT belum aktif (PENDIDIKAN_V2_UAT_ENABLED=false)";
                              } else if (serverSessionStatus === "SCHEMA_NOT_READY") {
                                notice = "Skema database belum siap";
                              } else if (serverSessionStatus === "PERMISSION_DENIED") {
                                notice = "Akses tidak diotorisasi";
                              } else if (!kpsSession) {
                                notice = "Sesi pembelajaran belum tersedia untuk tanggal ini";
                              } else if (kpsSession?.mutationDeniedReason === "AUTHENTICATION_REQUIRED") {
                                notice = "Harap masuk untuk mengelola sesi";
                              } else if (kpsSession?.mutationDeniedReason === "SCHEDULED_TEACHER_NOT_RESOLVED") {
                                notice = "Guru terjadwal belum terdaftar di sesi";
                              } else if (kpsSession?.mutationDeniedReason === "STAFF_NOT_LINKED") {
                                notice = "Profil pendidik staf belum terhubung";
                              } else if (kpsSession?.mutationDeniedReason === "SUBSTITUTE_TEACHER_POLICY_NOT_APPROVED") {
                                notice = "Bukan guru terjadwal — kebijakan badal belum aktif";
                              } else if (kpsSession?.mutationDeniedReason === "CANONICAL_AUTH_DENIED") {
                                notice = "Wewenang mengajar tidak mencukupi";
                              }

                              return (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled
                                  className="min-h-[44px] bg-slate-100 text-slate-400 cursor-not-allowed text-xs font-bold gap-1.5 border border-slate-200"
                                >
                                  <Lock className="h-4 w-4 text-slate-400" />
                                  {notice}
                                </Button>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Gating Grid: Materi & Presensi */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* 1. Pencatatan Materi Pembelajaran (Manual) */}
                          <div className="p-4 rounded-2xl border transition-all bg-slate-50/70 border-slate-200/80 opacity-90">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h5 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                                <FileText className="h-4 w-4 text-[#0E7C3A]" />
                                Catatan Materi Pelajaran (Manual)
                              </h5>
                              <Badge variant={kpsSession?.materialAvailable ? "green" : "neutral"} size="sm" className="font-semibold text-[10px]">
                                {!kpsSession?.materialAvailable && <Lock className="h-3 w-3 inline mr-1" />}
                                {kpsSession?.materialAvailable ? "Aktif" : "Terkunci"}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3">
                              Guru yang mengajar wajib menginput materi secara manual. Sistem tidak melakukan auto-advance.
                            </p>

                            <div className="space-y-2">
                              {(() => {
                                if (serverSessionStatus === "READY" && kpsSession && kpsSession.materialAvailable) {
                                  return (
                                    <div className="space-y-2">
                                      <textarea
                                        rows={2}
                                        placeholder="Ketik ringkasan materi pembelajaran..."
                                        value={inputMateriText}
                                        onChange={(e) => setInputMateriText(e.target.value)}
                                        className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white resize-none"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="primary"
                                        onClick={() => handleRecordMaterial(kpsSession.sessionId)}
                                        className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white text-xs font-bold"
                                      >
                                        Simpan Materi Sesi
                                      </Button>
                                    </div>
                                  );
                                }

                                let materialNotice = "Pencatatan materi pembelajaran belum diaktifkan — menunggu aktivasi M3.3C.";
                                if (kpsSession?.materialDeniedReason === "ACTOR_NOT_ACTUAL_TEACHER") {
                                  materialNotice = "Hanya guru aktual yang dapat mencatat materi pembelajaran.";
                                } else if (kpsSession?.materialDeniedReason === "SESSION_NOT_STARTED") {
                                  materialNotice = "Sesi belum dimulai. Klik 'Mulai Pembelajaran' terlebih dahulu.";
                                } else if (kpsSession?.materialDeniedReason === "UAT_NOT_ENABLED") {
                                  materialNotice = "UAT materi pembelajaran belum aktif di server.";
                                }

                                return (
                                  <>
                                    <textarea
                                      rows={2}
                                      disabled
                                      placeholder={materialNotice}
                                      value=""
                                      readOnly
                                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-400 bg-slate-100 cursor-not-allowed resize-none"
                                    />
                                    <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
                                      <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                                      <span>{materialNotice}</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* 2. Presensi Santri (HADIR, IZIN, SAKIT, ALFA) */}
                          <div className="p-4 rounded-2xl border transition-all bg-slate-50/70 border-slate-200/80 opacity-90">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h5 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-[#0E7C3A]" />
                                Presensi Santri Sesi KBM
                              </h5>
                              <Badge variant={kpsSession?.attendanceAvailable ? "green" : "neutral"} size="sm" className="font-semibold text-[10px]">
                                {!kpsSession?.attendanceAvailable && <Lock className="h-3 w-3 inline mr-1" />}
                                {kpsSession?.attendanceAvailable ? "Aktif" : "Terkunci"}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3">
                              Status resmi: <strong>HADIR</strong>, <strong>IZIN</strong>, <strong>SAKIT</strong>, <strong>ALFA</strong>. (Tanpa status Masbuk).
                            </p>

                            {(() => {
                              let attendanceNotice = "Presensi santri terverifikasi akan aktif pada Milestone 3.3C.";
                              if (kpsSession?.attendanceDeniedReason === "ACTOR_NOT_ACTUAL_TEACHER") {
                                attendanceNotice = "Hanya guru aktual yang dapat mencatat presensi santri.";
                              } else if (kpsSession?.attendanceDeniedReason === "SESSION_NOT_STARTED") {
                                attendanceNotice = "Sesi belum dimulai. Presensi terkunci hingga sesi dimulai.";
                              } else if (kpsSession?.attendanceDeniedReason === "STUDI_UMUM_ATTENDANCE_POLICY_DEFERRED") {
                                attendanceNotice = "Presensi Studi Umum ditangguhkan.";
                              }

                              return (
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center py-6">
                                  <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                  <p className="text-xs font-bold text-slate-600">Daftar peserta sesi belum diaktifkan.</p>
                                  <p className="text-[11px] text-slate-400 mt-1">{attendanceNotice}</p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* PENILAIAN KEPESANTRENAN (DEFERRED IN M3.3B) */}
              <Card rounded="3xl" className="border border-slate-200 shadow-xs bg-white">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm sm:text-base font-bold text-slate-900 font-heading flex items-center gap-2">
                        <BookMarked className="h-4 w-4 text-slate-400" />
                        PENILAIAN KEPESANTRENAN
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Belum diaktifkan — format penilaian belum ditetapkan.
                      </CardDescription>
                    </div>
                    <Badge variant="neutral" size="sm" className="font-semibold text-xs">
                      <Lock className="h-3 w-3 inline mr-1" />
                      Penilaian Ditangguhkan
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 pb-6">
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center max-w-lg mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                      <Lock className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 font-heading">
                      Penilaian Kepesantrenan Belum Diaktifkan
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Belum diaktifkan — format penilaian belum ditetapkan. Kebijakan komponen evaluasi, pembobotan, dan pengujian belum difinalisasi oleh pimpinan ma&apos;had.
                    </p>
                    <p className="text-[11px] text-slate-400 italic">
                      Rekapitulasi riwayat nilai terdahulu tetap dapat ditinjau pada tabel di bawah untuk kebutuhan arsip dan kompatibilitas sistem.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Rekapitulasi Riwayat Nilai Kepesantrenan */}
              <Card rounded="3xl" className="border border-slate-200 shadow-xs bg-white">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm sm:text-base font-bold text-slate-900 font-heading">
                      Rekapitulasi Nilai Kepesantrenan Terverifikasi
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Daftar nilai 5 materi kepesantrenan yang tersimpan pada pangkalan data riil.
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Cari santri atau mapel..."
                      value={kpsSearch}
                      onChange={(e) => setKpsSearch(e.target.value)}
                      className="pl-8 text-xs h-9"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <th className="px-4 py-3">Nama Santri</th>
                        <th className="px-3 py-3">Kelas</th>
                        <th className="px-3 py-3">Mata Pelajaran</th>
                        <th className="px-3 py-3 text-center">Evaluasi</th>
                        <th className="px-3 py-3 text-center">Nilai Angka</th>
                        <th className="px-3 py-3 text-center">Predikat</th>
                        <th className="px-3 py-3">Pengampu</th>
                        <th className="px-4 py-3">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kpsNilaiList
                        .filter(
                          (item) =>
                            item.santriNama.toLowerCase().includes(kpsSearch.toLowerCase()) ||
                            item.mapelNama.toLowerCase().includes(kpsSearch.toLowerCase()) ||
                            item.kodeMapel.toLowerCase().includes(kpsSearch.toLowerCase()) ||
                            item.santriNis.toLowerCase().includes(kpsSearch.toLowerCase())
                        )
                        .map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {row.santriNama}
                              <span className="block text-[10px] text-slate-400 font-mono">{row.santriNis}</span>
                            </td>
                            <td className="px-3 py-3 text-slate-600">{row.santriKelas}</td>
                            <td className="px-3 py-3 font-semibold text-slate-700">
                              <Badge variant="neutral" size="sm" className="font-mono text-[10px] mr-1.5">
                                {row.kodeMapel}
                              </Badge>
                              {row.mapelNama}
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-[11px] text-slate-600">
                              {row.jenis}
                            </td>
                            <td className="px-3 py-3 text-center font-extrabold text-slate-900 text-sm">
                              {row.angka}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <Badge
                                variant={row.huruf === "A" ? "green" : row.huruf === "B" ? "sky" : "orange"}
                                size="sm"
                                className="font-bold"
                              >
                                {row.huruf}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-slate-600">{row.guruNama}</td>
                            <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate">
                              {row.catatan || "-"}
                            </td>
                          </tr>
                        ))}
                      {kpsNilaiList.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                            Belum ada rekap nilai materi kepesantrenan pada periode ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
        </div>
      )}

      {/* Modal Cetak Rapor */}
      {showPrintRaporModal && currentSantri && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-rapor-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="print-rapor-title" className="text-base font-bold text-slate-900 font-heading">
                Pratinjau Cetak Rapor Santri A4 Resmi
              </h3>
              <button
                type="button"
                aria-label="Tutup Pratinjau Rapor"
                data-testid="btn-close-print-modal"
                onClick={() => setShowPrintRaporModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-white p-4 border rounded-2xl shadow-inner">
              <PrintRapor
                santri={{
                  nis: currentSantri.nis,
                  nama: currentSantri.nama,
                  kelas: currentSantri.kelas,
                  halaqoh: currentSantri.halaqoh,
                  capaianJuz: currentSantri.capaianJuz,
                  targetJuz: currentSantri.targetJuz,
                }}
                nilaiAkademik={santriNilaiForRapor.map((n) => ({
                  mapel: n.mapel,
                  kategori: n.kategori,
                  angka: n.angka,
                  huruf: n.huruf,
                  guru: n.guru,
                }))}
                semester={selectedSemester === 1 ? "Ganjil" : "Genap"}
                tahunAjaran={selectedTahunAjaran}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
