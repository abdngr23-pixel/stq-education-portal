"use client";

import React, { useState } from "react";
import { Role } from "@/types/auth";
import { DashboardSantriSummary } from "./beranda-module";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrintSurat } from "@/components/print/print-surat";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";
import {
  FileText,
  Printer,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
} from "lucide-react";

export interface SuratModuleProps {
  userRole: Role;
  currentUserName: string;
  santriList: DashboardSantriSummary[];
}

export type JenisSurat =
  | "SURAT_KETERANGAN_AKTIF"
  | "SURAT_UNDANGAN_WALI"
  | "SURAT_IZIN_KEGIATAN"
  | "SURAT_REKOMENDASI";

export function SuratModule({
  userRole,
  currentUserName,
  santriList,
}: SuratModuleProps) {
  const [jenisSurat, setJenisSurat] = useState<JenisSurat>("SURAT_KETERANGAN_AKTIF");

  const [selectedSantriNis, setSelectedSantriNis] = useState(santriList[0]?.nis || "");
  const [perihal, setPerihal] = useState("Surat Keterangan Santri Aktif Pondok Pesantren");
  const [tujuan, setTujuan] = useState("Kementerian Agama / Lembaga Beasiswa");
  const [isiPokok, setIsiPokok] = useState(
    "Menerangkan bahwa santri yang bersangkutan terdaftar aktif dalam program ketahfidzhan dan pendidikan kesantrian di STQ Darul Ulum Cendekia untuk Tahun Ajaran 2026/2027."
  );

  const [nomorSurat, setNomorSurat] = useState("012/STQ-DUC/SK/IX/2026");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const currentSantri = santriList.find((s) => s.nis === selectedSantriNis) || santriList[0];

  const handleBuatDraf = () => {
    setFeedback({
      type: "success",
      message: `Draf naskah surat "${perihal}" berhasil disusun dan siap dicetak ke kop resmi A4.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Operasional */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-700" />
            Pembuatan Draf Surat Resmi Lembaga
          </h2>
          <p className="text-xs text-slate-500">
            Penyusunan naskah administrasi baku berstandar {INSTITUTION_CONFIG.schoolName} • Draf oleh: {currentUserName} ({userRole})
          </p>
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

      {/* Grid Form Pembuatan Surat & Pratinjau */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom Kiri: Form Parameter Surat */}
        <Card rounded="3xl" className="border border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900 font-heading">
              Formulir Administrasi Surat
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Lengkapi data penerima, santri terkait, dan substansi surat
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Jenis Template Surat
              </label>
              <select
                value={jenisSurat}
                onChange={(e) => {
                  const val = e.target.value as JenisSurat;
                  setJenisSurat(val);
                  if (val === "SURAT_KETERANGAN_AKTIF") {
                    setPerihal("Surat Keterangan Santri Aktif Pondok Pesantren");
                    setIsiPokok("Menerangkan bahwa santri yang bersangkutan terdaftar aktif dalam program ketahfidzhan dan pendidikan kesantrian di STQ Darul Ulum Cendekia.");
                  } else if (val === "SURAT_UNDANGAN_WALI") {
                    setPerihal("Undangan Pertemuan Evaluasi Hasil Belajar Semester Ganjil");
                    setIsiPokok("Mengharap kehadiran Bapak/Ibu Wali Santri pada pertemuan evaluasi pembelajaran dan pengasuhan santri di Aula Pesantren.");
                  } else if (val === "SURAT_IZIN_KEGIATAN") {
                    setPerihal("Permohonan Izin Kegiatan Rihlah Tarbawiyah & Camping Qur'an");
                    setIsiPokok("Pemberitahuan dan izin pelaksanaan kegiatan outdoor tadabbur alam santri.");
                  } else {
                    setPerihal("Surat Rekomendasi Prestasi Tahfizh Santri");
                    setIsiPokok("Memberikan rekomendasi atas capaian mutqin dan akhlak mulia santri untuk keperluan beasiswa lanjutan.");
                  }
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold"
              >
                <option value="SURAT_KETERANGAN_AKTIF">Surat Keterangan Santri Aktif</option>
                <option value="SURAT_UNDANGAN_WALI">Surat Undangan Wali Santri</option>
                <option value="SURAT_IZIN_KEGIATAN">Surat Pemberitahuan / Izin Kegiatan</option>
                <option value="SURAT_REKOMENDASI">Surat Rekomendasi Prestasi Santri</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Santri Terkait
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

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nomor Surat Resmi
              </label>
              <Input
                value={nomorSurat}
                onChange={(e) => setNomorSurat(e.target.value)}
                placeholder="Contoh: 012/STQ-DUC/SK/IX/2026"
                className="min-h-[44px] text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Perihal Surat
              </label>
              <Input
                value={perihal}
                onChange={(e) => setPerihal(e.target.value)}
                className="min-h-[44px] text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Tujuan / Penerima Surat
              </label>
              <Input
                value={tujuan}
                onChange={(e) => setTujuan(e.target.value)}
                className="min-h-[44px] text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Isi Pokok Surat
              </label>
              <textarea
                rows={3}
                value={isiPokok}
                onChange={(e) => setIsiPokok(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                onClick={handleBuatDraf}
                className="flex-1 min-h-[46px] font-bold text-sm bg-[#0E7C3A] hover:bg-[#0B642E]"
              >
                <FileCheck className="h-4 w-4 mr-1.5" />
                Susun Naskah Surat
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kolom Kanan: Pratinjau Naskah & Cetak */}
        <Card rounded="3xl" className="border border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 font-heading">
                Pratinjau Draf Surat
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Format naskah resmi lembaga siap cetak
              </CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPrintModal(true)}
              className="text-xs font-bold gap-1 min-h-[36px]"
            >
              <Printer className="h-3.5 w-3.5" />
              Cetak A4
            </Button>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs sm:text-sm text-slate-800">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 font-mono text-[11px] sm:text-xs leading-relaxed space-y-2">
              <div className="flex justify-between border-b pb-2">
                <span>Nomor: {nomorSurat}</span>
                <span>Makassar, 9 September 2026</span>
              </div>
              <p>Lampiran: -</p>
              <p>Perihal: <strong>{perihal}</strong></p>
              <p className="pt-2">Kepada Yth.<br /><strong>{tujuan}</strong><br />Di tempat</p>
              <p className="pt-2"><em>Assalamu&apos;alaikum Warahmatullahi Wabarakatuh</em></p>
              <p className="pt-1">
                Dengan hormat, bersama surat ini kami dari pimpinan {INSTITUTION_CONFIG.schoolName} ({INSTITUTION_CONFIG.yayasanName}) menerangkan mengenai santri kami:
              </p>
              <div className="pl-4 py-1 space-y-0.5">
                <p>Nama Lengkap : <strong>{currentSantri.nama}</strong></p>
                <p>Nomor Induk   : <strong>{currentSantri.nis}</strong></p>
                <p>Kelas/Jenjang : <strong>{currentSantri.kelas}</strong></p>
                <p>Kelompok      : <strong>{currentSantri.halaqoh}</strong></p>
              </div>
              <p>{isiPokok}</p>
              <p className="pt-2">
                Demikian surat ini kami terbitkan dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.
              </p>
              <p className="pt-2"><em>Wassalamu&apos;alaikum Warahmatullahi Wabarakatuh</em></p>
              <div className="pt-4 flex justify-end">
                <div className="text-center">
                  <p>Mudir Pesantren,</p>
                  <div className="h-10" />
                  <p className="font-bold underline">{INSTITUTION_CONFIG.mudirName}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Cetak Surat Resmi */}
      {showPrintModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-surat-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="print-surat-modal-title" className="text-base font-bold text-slate-900 font-heading">
                Pratinjau Cetak Surat Resmi A4
              </h3>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-white p-4 border rounded-2xl shadow-inner">
              <PrintSurat
                nomorSurat={nomorSurat}
                perihal={perihal}
                tujuan={tujuan}
                santriNama={currentSantri.nama}
                santriNis={currentSantri.nis}
                santriKelas={currentSantri.kelas}
                isiPokok={isiPokok}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
