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
  getMataPelajaranKepesantrenanAction,
  inputNilaiKepesantrenanAction,
  getNilaiKepesantrenanSantriAction,
} from "@/app/actions/kepesantrenan";
import { konversiPredikatNilai, konversiAngkaKeHurufKepesantrenan as konversiAngkaKeHuruf } from "@/lib/educational-rules";
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
  ShieldAlert,
  BookMarked,
  Save,
  Check,
  Search,
} from "lucide-react";

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

export const MAPEL_OPTIONS = [
  { id: "MP-KP-01", nama: "Bahasa Arab", kategori: "Kepesantrenan", guru: "Ustzh. Nurul Hidayah, S.Pd." },
  { id: "MP-KP-02", nama: "Tafsir Al-Qur'an", kategori: "Kepesantrenan", guru: "Ust. Razan Mufli, S.Pd" },
  { id: "MP-KP-03", nama: "Fikih Ibadah & Muamalah", kategori: "Kepesantrenan", guru: "Ust. Mujaddid Zhohruddin" },
  { id: "MP-KP-04", nama: "Aqidah Islamiyyah", kategori: "Kepesantrenan", guru: "Ust. Andi Quarzy Ayatullah, S.H, M.H" },
  { id: "MP-KP-05", nama: "Ilmu Tajwid", kategori: "Kepesantrenan", guru: "Ust. Razan Mufli, S.Pd" },
  { id: "MP-SU-01", nama: "Matematika Terapan", kategori: "Studi Umum", guru: "Ustzh. Nurul Hidayah, S.Pd." },
  { id: "MP-SU-02", nama: "Bahasa Inggris", kategori: "Studi Umum", guru: "Ustzh. Nurul Hidayah, S.Pd." },
  { id: "MP-SU-03", nama: "Bahasa Indonesia (PBL)", kategori: "Studi Umum (PBL)", guru: "Ustzh. Nurul Hidayah, S.Pd." },
];

export const KEPESANTRENAN_INFO = [
  {
    kode: "KPS-ARB",
    nama: "Bahasa Arab",
    kitab: "Durusul Lughah & Al-Muyassar fi 'Ilmin Nahwi",
    deskripsi: "Tata bahasa Arab (Nahwu & Sharaf), tarkib jumlah, mufradat tematik, dan percakapan ma'had.",
    guruDefault: "Ustzh. Nurul Hidayah, S.Pd.",
  },
  {
    kode: "KPS-FQH",
    nama: "Fikih Ibadah & Muamalah",
    kitab: "Matan Al-Ghayah wat Taqrib (Abu Syuja')",
    deskripsi: "Kaidah thaharah, shalat wajib & sunnah, shiyam, janazah, dan adab muamalah santri.",
    guruDefault: "Ust. Mujaddid Zhohruddin",
  },
  {
    kode: "KPS-TFS",
    nama: "Tafsir Al-Qur'an",
    kitab: "Tafsir Al-Muyassar / Jalalain (Juz 'Amma & Pilihan)",
    deskripsi: "Tadabbur makna ayat, asbabun nuzul, pesan aqidah tauhid, dan hukum syari'at.",
    guruDefault: "Ust. Razan Mufli, S.Pd",
  },
  {
    kode: "KPS-TJW",
    nama: "Ilmu Tajwid & Tahsin",
    kitab: "Matan Jazariyyah & Tuhfatul Athfal",
    deskripsi: "Makharijul huruf, sifatul huruf, ahkam nun mati & tanwin, mad wal qasr, waqaf & ibtida'.",
    guruDefault: "Ust. Razan Mufli, S.Pd",
  },
  {
    kode: "KPS-AQD",
    nama: "Aqidah Islamiyyah",
    kitab: "Al-Ushul Ats-Tsalatsah & Aqidatul Awwam",
    deskripsi: "Rukun iman, ma'rifatullah, ma'rifatun nabi, manhaj ahlussunnah wal jama'ah, & tauhid.",
    guruDefault: "Ust. Andi Quarzy Ayatullah, S.H, M.H",
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
  const [selectedMapelId, setSelectedMapelId] = useState<string>("MP-KP-01");
  const [selectedJenisNilai, setSelectedJenisNilai] = useState<JenisNilai>("TUGAS");

  // Filter Santri yang Aktif Dinilai - Mulai kosong, tidak default ke angka 90 atau santri sembarang
  const [selectedSantriNis, setSelectedSantriNis] = useState<string>(santriList[0]?.nis || "");
  const [inputNilaiAngka, setInputNilaiAngka] = useState<string>("");
  const [catatanNilai, setCatatanNilai] = useState<string>("");

  // Daftar Nilai Akademik Terverifikasi
  const [nilaiList, setNilaiList] = useState<NilaiItem[]>([
    { santriNis: "SAN-0001", santriNama: "Obama Ozearld Egberted Turizqi", mapel: "Bahasa Arab", kategori: "Kepesantrenan", angka: 90, huruf: "A", guru: "Ustzh. Nurul Hidayah, S.Pd." },
    { santriNis: "SAN-0001", santriNama: "Obama Ozearld Egberted Turizqi", mapel: "Tafsir Al-Qur'an", kategori: "Kepesantrenan", angka: 94, huruf: "A", guru: "Ust. Razan Mufli, S.Pd" },
    { santriNis: "SAN-0001", santriNama: "Obama Ozearld Egberted Turizqi", mapel: "Fikih Ibadah & Muamalah", kategori: "Kepesantrenan", angka: 92, huruf: "A", guru: "Ust. Mujaddid Zhohruddin" },
    { santriNis: "SAN-0001", santriNama: "Obama Ozearld Egberted Turizqi", mapel: "Aqidah Islamiyyah", kategori: "Kepesantrenan", angka: 95, huruf: "A", guru: "Ust. Andi Quarzy Ayatullah, S.H, M.H" },
    { santriNis: "SAN-0001", santriNama: "Obama Ozearld Egberted Turizqi", mapel: "Ilmu Tajwid", kategori: "Kepesantrenan", angka: 91, huruf: "A", guru: "Ust. Razan Mufli, S.Pd" },
    { santriNis: "SAN-0001", santriNama: "Obama Ozearld Egberted Turizqi", mapel: "Matematika Terapan", kategori: "Studi Umum", angka: 86, huruf: "B", guru: "Ustzh. Nurul Hidayah, S.Pd." },
    { santriNis: "SAN-0001", santriNama: "Obama Ozearld Egberted Turizqi", mapel: "Bahasa Inggris", kategori: "Studi Umum", angka: 88, huruf: "B", guru: "Ustzh. Nurul Hidayah, S.Pd." },
    { santriNis: "SAN-0001", santriNama: "Obama Ozearld Egberted Turizqi", mapel: "Bahasa Indonesia (PBL)", kategori: "Studi Umum (PBL)", angka: 90, huruf: "A", guru: "Ustzh. Nurul Hidayah, S.Pd." },
  ]);

  // Load data nilai riil dari server action on mount
  useEffect(() => {
    let isMounted = true;
    getNilaiAkademikListAction().then((res) => {
      if (isMounted && res.success && res.data && res.data.length > 0) {
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
      }
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
  const currentMapel = MAPEL_OPTIONS.find((m) => m.id === selectedMapelId) || MAPEL_OPTIONS[0];

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
  const [kepesantrenanMapelList, setKepesantrenanMapelList] = useState<
    Array<{ id: string; kodeMapel: string; nama: string; guru?: { nama: string } | null }>
  >([]);
  const [selectedKpsKode, setSelectedKpsKode] = useState<string>("KPS-ARB");
  const [selectedKpsSantriId, setSelectedKpsSantriId] = useState<string>("");
  const effectiveKpsSantriId =
    selectedKpsSantriId && santriList.some((s) => s.id === selectedKpsSantriId)
      ? selectedKpsSantriId
      : santriList[0]?.id || "";
  const [inputKpsAngka, setInputKpsAngka] = useState<string>("");
  const [catatanKps, setCatatanKps] = useState<string>("");
  const [selectedKpsJenis, setSelectedKpsJenis] = useState<JenisNilai>("TUGAS");
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

  // Load data mapel & nilai kepesantrenan dari DB
  useEffect(() => {
    let isMounted = true;
    getMataPelajaranKepesantrenanAction().then((res) => {
      if (isMounted && res.success && res.data && res.data.length > 0) {
        setKepesantrenanMapelList(
          res.data.map((m) => ({
            id: m.id,
            kodeMapel: m.kodeMapel,
            nama: m.nama,
            guru: m.guru,
          }))
        );
      }
    });

    getNilaiKepesantrenanSantriAction({}).then((res) => {
      if (isMounted && res.success && res.data) {
        setKpsNilaiList(res.data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveKepesantrenan = () => {
    setFeedback(null);
    if (!["KS", "MT", "PH", "ADM"].includes(userRole)) {
      setFeedback({
        type: "error",
        message: `Akses Ditolak: Peran '${userRole}' tidak berwenang mengelola nilai Kepesantrenan (khusus KS, MT, PH).`,
      });
      return;
    }

    const santriObj = santriList.find((s) => s.id === effectiveKpsSantriId);
    if (!santriObj) {
      setFeedback({ type: "error", message: "Silakan pilih santri terlebih dahulu." });
      return;
    }

    if (!inputKpsAngka.trim()) {
      setFeedback({ type: "error", message: "Nilai angka kepesantrenan wajib diisi." });
      return;
    }

    const angkaNum = parseFloat(inputKpsAngka);
    if (isNaN(angkaNum) || angkaNum < 0 || angkaNum > 100) {
      setFeedback({ type: "error", message: "Nilai angka harus berada dalam rentang 0 hingga 100." });
      return;
    }

    const mapelObj = kepesantrenanMapelList.find((m) => m.kodeMapel === selectedKpsKode);
    const mapelId = mapelObj?.id || selectedKpsKode;

    startTransition(async () => {
      const res = await inputNilaiKepesantrenanAction({
        santriId: santriObj.id,
        mapelId: mapelId,
        semester: selectedSemester,
        tahunAjaran: selectedTahunAjaran,
        jenis: selectedKpsJenis,
        angka: angkaNum,
        catatan: catatanKps,
      });

      if (res.success) {
        const huruf = konversiAngkaKeHuruf(angkaNum);
        setFeedback({
          type: "success",
          message: res.message || `Nilai kepesantrenan untuk ${santriObj.nama} berhasil disimpan (${angkaNum} - ${huruf}).`,
        });
        setInputKpsAngka("");
        setCatatanKps("");
        const refreshRes = await getNilaiKepesantrenanSantriAction({});
        if (refreshRes.success && refreshRes.data) {
          setKpsNilaiList(refreshRes.data);
        }
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Gagal menyimpan nilai materi kepesantrenan.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigasi: Input Nilai vs Rapor Santri */}
      <div className="flex items-center justify-between p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSubTab("input_nilai")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              subTab === "input_nilai"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Input Penilaian Akademik
          </button>
          <button
            type="button"
            onClick={() => setSubTab("rapor")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              subTab === "rapor"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <Printer className="h-4 w-4" />
            Pratinjau &amp; Cetak Rapor
          </button>
          <button
            type="button"
            onClick={() => setSubTab("kepesantrenan")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              subTab === "kepesantrenan"
                ? "bg-[#0E7C3A] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Materi Kepesantrenan
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
                    {MAPEL_OPTIONS.map((m) => (
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
                      {nilaiList.filter((n) => n.mapel === currentMapel.nama).length > 0 ? (
                        nilaiList
                          .filter((n) => n.mapel === currentMapel.nama)
                          .map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-800">
                                {item.santriNama || currentSantri?.nama || "-"}
                                <span className="block text-[11px] text-slate-400 font-normal">
                                  {item.santriNis || currentSantri?.nis || "-"}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-slate-700">
                                {item.mapel}
                                <span className="block text-[10px] text-slate-400">{item.kategori}</span>
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
                              <td className="px-4 py-3 text-slate-600 font-medium">
                                {item.guru}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-slate-400 text-xs">
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
              <div className="flex items-center gap-2">
                <select
                  value={selectedSantriNis}
                  onChange={(e) => setSelectedSantriNis(e.target.value)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                >
                  <option value="">-- Pilih Santri --</option>
                  {santriList.map((s) => (
                    <option key={s.nis} value={s.nis}>
                      {s.nama} ({s.kelas})
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!currentSantri}
                  onClick={() => setShowPrintRaporModal(true)}
                  className="bg-[#0E7C3A] hover:bg-[#0B642E] text-xs font-bold gap-1.5 min-h-[40px] disabled:opacity-50"
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
                      <p className="text-slate-500">Nama Santri:</p>
                      <strong className="text-base text-slate-900">{currentSantri.nama}</strong>
                      <p className="text-slate-500 mt-1">NIS: {currentSantri.nis} • Kelas: {currentSantri.kelas}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-slate-500">Tahun Ajaran / Semester:</p>
                      <strong className="text-slate-900">{selectedTahunAjaran} • Semester {selectedSemester}</strong>
                      <p className="text-slate-500 mt-1">Capaian Tahfizh: {currentSantri.capaianJuz} Juz</p>
                    </div>
                  </div>

                  {/* Tabel Nilai Rapor Jujur */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
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
                        {santriNilaiForRapor.length > 0 ? (
                          santriNilaiForRapor.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3 font-semibold text-slate-800">{item.mapel}</td>
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
                              <td className="px-4 py-3 text-slate-600">{item.guru}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="text-center py-12 text-slate-400 text-xs">
                              Belum ada data nilai akademik yang dicatat untuk santri ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm">
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
          {/* Fail-Closed Check */}
          {!["KS", "MT", "PH", "ADM"].includes(userRole) ? (
            <Card rounded="3xl" className="border border-amber-200 bg-amber-50/60 p-6 sm:p-8">
              <div className="flex flex-col items-center text-center max-w-lg mx-auto space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shadow-xs">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <div>
                  <Badge variant="orange" size="md" className="font-bold mb-2">
                    AKSES DITOLAK (FAIL-CLOSED)
                  </Badge>
                  <h3 className="text-lg font-bold text-slate-900 font-heading">
                    Akses Terbatas: Kurikulum Kepesantrenan
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                    Pengelolaan kurikulum dan penilaian 5 Mata Pelajaran Kepesantrenan dilindungi dengan kebijakan ketat (fail-closed) dan hanya dapat diakses oleh <strong>Mudir (KS)</strong>, <strong>Musyrif Tahfizh (MT)</strong>, dan <strong>Pembina Asrama (PH)</strong>.
                  </p>
                  <p className="text-xs text-amber-800 font-semibold mt-3 bg-amber-100/70 p-2.5 rounded-xl border border-amber-200">
                    Peran Anda saat ini (<strong>{userRole}</strong>) tidak memiliki hak otorisasi untuk mencatat atau mengubah nilai kepesantrenan. Untuk input nilai Studi Umum, silakan gunakan tab <em>Input Penilaian Akademik</em>.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <>
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
                          <p className="font-medium text-slate-800 italic">{kps.kitab}</p>
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

              {/* Formulir Input Nilai Kepesantrenan */}
              <Card rounded="3xl" className="border border-slate-200 shadow-xs bg-white">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm sm:text-base font-bold text-slate-900 font-heading flex items-center gap-2">
                        <BookMarked className="h-4 w-4 text-[#0E7C3A]" />
                        Formulir Evaluasi Nilai: {KEPESANTRENAN_INFO.find((k) => k.kode === selectedKpsKode)?.nama} ({selectedKpsKode})
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Input nilai santri menggunakan primary key riil database. Predikat huruf otomatis dihitung server.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Pilih Santri */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                        Pilih Santri
                      </label>
                      <select
                        value={effectiveKpsSantriId}
                        onChange={(e) => setSelectedKpsSantriId(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                      >
                        {santriList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nama} ({s.kelas}) - {s.nis}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mata Pelajaran */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                        Mata Pelajaran
                      </label>
                      <select
                        value={selectedKpsKode}
                        onChange={(e) => setSelectedKpsKode(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                      >
                        {KEPESANTRENAN_INFO.map((k) => (
                          <option key={k.kode} value={k.kode}>
                            {k.kode} - {k.nama}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Jenis Evaluasi */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                        Jenis Evaluasi
                      </label>
                      <select
                        value={selectedKpsJenis}
                        onChange={(e) => setSelectedKpsJenis(e.target.value as JenisNilai)}
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold"
                      >
                        <option value="TUGAS">Tugas / Mutaba&apos;ah</option>
                        <option value="UH">Ulangan Harian (UH)</option>
                        <option value="UTS">Ujian Tengah Semester (UTS)</option>
                        <option value="UAS">Ujian Akhir Semester (UAS)</option>
                      </select>
                    </div>

                    {/* Nilai Angka */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Nilai Angka (0-100)
                        </label>
                        {inputKpsAngka && !isNaN(parseFloat(inputKpsAngka)) && (
                          <Badge
                            variant={
                              parseFloat(inputKpsAngka) >= 85
                                ? "green"
                                : parseFloat(inputKpsAngka) >= 75
                                ? "sky"
                                : "orange"
                            }
                            size="sm"
                            className="font-bold"
                          >
                            Predikat: {konversiAngkaKeHuruf(parseFloat(inputKpsAngka))}
                          </Badge>
                        )}
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="Contoh: 88"
                        value={inputKpsAngka}
                        onChange={(e) => setInputKpsAngka(e.target.value)}
                        className="min-h-[42px] text-xs sm:text-sm font-bold"
                      />
                    </div>
                  </div>

                  {/* Catatan Pengampu */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                      Catatan Evaluasi / Pengampu (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={catatanKps}
                      onChange={(e) => setCatatanKps(e.target.value)}
                      placeholder="Catatan keaktifan santri, setoran hafalan matan, atau pemahaman kaidah..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveKepesantrenan}
                      disabled={isPending || !inputKpsAngka}
                      className="bg-[#0E7C3A] hover:bg-[#0B642E] text-xs font-bold gap-2 px-6 min-h-[42px]"
                    >
                      <Save className="h-4 w-4" />
                      {isPending ? "Menyimpan Nilai..." : "Simpan Nilai Kepesantrenan"}
                    </Button>
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
            </>
          )}
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
                onClick={() => setShowPrintRaporModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
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
