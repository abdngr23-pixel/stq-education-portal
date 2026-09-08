"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  Clock,
  GraduationCap,
  HeartHandshake,
  LogIn,
  MapPin,
  Phone,
  ShieldCheck,
  Users,
  ChevronRight,
  Info,
} from "lucide-react";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";
import { getPublicAgendaAction } from "@/app/actions/kalender";

interface PublicAgendaItem {
  id: string;
  judul: string;
  deskripsi: string | null;
  tanggalMulai: string;
  tanggalSelesai: string | null;
  kategori: string;
  lokasi: string | null;
}

export default function ProfilPublicPage() {
  const [agendas, setAgendas] = useState<PublicAgendaItem[]>([]);
  const [isAgendaLoading, setIsAgendaLoading] = useState<boolean>(true);
  const [activeTabKurikulum, setActiveTabKurikulum] = useState<"tahfizh" | "evaluasi" | "jenjang">("tahfizh");

  useEffect(() => {
    async function loadAgendas() {
      try {
        const res = await getPublicAgendaAction();
        if (res.success && res.data) {
          setAgendas(res.data);
        }
      } catch {
        // Biarkan daftar kosong secara jujur
      } finally {
        setIsAgendaLoading(false);
      }
    }
    loadAgendas();
  }, []);

  const formatWitaDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("id-ID", {
        timeZone: "Asia/Makassar",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-[#0E7C3A]/20 selection:text-[#0E7C3A] font-sans">
      {/* 1. STICKY TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <Link href="/profil" className="flex items-center gap-3 group shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-11 w-11 rounded-2xl bg-white p-1 border border-slate-200 shadow-xs flex items-center justify-center">
                <img
                  src="/logo-yayasan.png"
                  alt="Logo Yayasan Infak Medika Nusantara"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="h-11 w-11 rounded-2xl bg-white p-1 border border-slate-200 shadow-xs flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Logo STQ Darul Ulum Cendekia"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-base sm:text-lg text-slate-900 font-heading block leading-tight group-hover:text-[#0E7C3A] transition-colors">
                {INSTITUTION_CONFIG.schoolName}
              </span>
              <span className="text-xs text-slate-500 font-medium line-clamp-1">
                Yayasan Infak Medika Nusantara - Alumni FKUH
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a href="#profil-yayasan" className="hover:text-[#0E7C3A] transition-colors py-2">
              Profil &amp; Yayasan
            </a>
            <a href="#kurikulum" className="hover:text-[#0E7C3A] transition-colors py-2">
              Kurikulum Tahfizh
            </a>
            <a href="#jadwal" className="hover:text-[#0E7C3A] transition-colors py-2">
              Jadwal Harian
            </a>
            <a href="#agenda" className="hover:text-[#0E7C3A] transition-colors py-2">
              Kalender Agenda
            </a>
            <a href="#kontak" className="hover:text-[#0E7C3A] transition-colors py-2">
              Kontak
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 min-h-[44px] min-w-[44px]"
            >
              <LogIn className="h-4 w-4" />
              <span>Masuk Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION DENGAN FAKTA OTENTIK */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-20 bg-gradient-to-b from-emerald-50/60 via-white to-slate-50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-5 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-300/80 text-[#0E7C3A] text-xs sm:text-sm font-bold shadow-2xs">
              <ShieldCheck className="h-4 w-4" />
              <span>Sekolah Tahfizh Al-Qur&apos;an Berasrama Full Beasiswa</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight font-heading">
              Membentuk Santri Cendekia, Hafal Al-Qur&apos;an, dan Berakhlak Mulia
            </h1>

            {/* FAKTA RESMI SESUAI INSTRUKSI */}
            <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-normal">
              <strong>STQ Darul Ulum Cendekia</strong> merupakan sekolah tahfizh berasrama dengan beasiswa penuh bagi santri dhuafa dan yatim, dikelola oleh <strong>Yayasan Infak Medika Nusantara</strong>, yang didukung alumni Fakultas Kedokteran Universitas Hasanuddin.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-sm sm:text-base px-6 py-3 rounded-xl shadow-md transition-all flex items-center gap-2 min-h-[46px]"
              >
                <LogIn className="h-4 w-4" />
                <span>Masuk ke Portal Santri &amp; Staf</span>
              </Link>

              <a
                href="#kurikulum"
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-sm sm:text-base px-5 py-3 rounded-xl transition-all flex items-center gap-2 min-h-[46px]"
              >
                <span>Pelajari Kurikulum Al-Pakistani</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SECTION 1: PROFIL YAYASAN & MODEL PENDANAAN ORANG TUA ASUH */}
      <section id="profil-yayasan" className="scroll-mt-24 py-16 sm:py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0E7C3A] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Amanah &amp; Akuntabilitas Penyelenggara
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
              Sinergi Lembaga &amp; Model Pendanaan Santri
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Pendidikan ketahfidzhan dan asrama diselenggarakan secara mandiri berbasis kepedulian umat tanpa memungut biaya dari santri yatim dan dhuafa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-white p-1 border border-slate-200 shadow-xs flex items-center justify-center">
                <img
                  src="/logo-yayasan.png"
                  alt="Logo Yayasan Infak Medika Nusantara"
                  className="h-full w-full object-contain"
                />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                Yayasan Infak Medika Nusantara
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Didirikan dan didukung oleh alumni Fakultas Kedokteran Universitas Hasanuddin (FKUH) dengan komitmen mewujudkan sarana pendidikan Al-Qur&apos;an yang berkualitas, amanah, dan berorientasi sosial.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-[#0E7C3A] flex items-center justify-center">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                Program Orang Tua Asuh (OTA)
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Dukungan operasional santri bersumber dari infak para donatur. Sebagian donatur berkomitmen menjadi orang tua asuh bagi santri tertentu guna menopang biaya makan bergizi, akomodasi, dan pembinaan santri secara berkelanjutan.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading">
                Laporan Bulanan Perkembangan
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Donatur yang belum memiliki santri asuh tetap dapat mendukung program secara umum. Bagi orang tua asuh, pengurus menyusun dan mengirimkan laporan perkembangan santri asuh setiap bulan sebagai bentuk pertanggungjawaban amanah.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SECTION 2: KURIKULUM RESMI (ALUR PENDIDIKAN.PDF) */}
      <section id="kurikulum" className="scroll-mt-24 py-16 sm:py-20 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0E7C3A] bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-300/80">
              Dokumen Acuan: ALUR PENDIDIKAN SANTRI
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
              Kurikulum Tahfizh Al-Qur&apos;an Metode Al-Pakistani
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Diselenggarakan secara sistematis dan berkesinambungan untuk membentuk hafalan yang mutqin dan terjaga kualitasnya.
            </p>
          </div>

          {/* Toggle Tab Sub-Kurikulum */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3" role="tablist">
            <button
              type="button"
              onClick={() => setActiveTabKurikulum("tahfizh")}
              className={`text-sm font-bold px-4 py-2.5 rounded-xl transition-all min-h-[44px] ${
                activeTabKurikulum === "tahfizh"
                  ? "bg-[#0E7C3A] text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              4 Komponen Pembelajaran (Sabaq, Sabqi, Manzil, Mufar)
            </button>
            <button
              type="button"
              onClick={() => setActiveTabKurikulum("evaluasi")}
              className={`text-sm font-bold px-4 py-2.5 rounded-xl transition-all min-h-[44px] ${
                activeTabKurikulum === "evaluasi"
                  ? "bg-[#0E7C3A] text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Alur Evaluasi Kenaikan Juz (Rubu&apos; → Tasmi&apos; → Ikhtibar)
            </button>
            <button
              type="button"
              onClick={() => setActiveTabKurikulum("jenjang")}
              className={`text-sm font-bold px-4 py-2.5 rounded-xl transition-all min-h-[44px] ${
                activeTabKurikulum === "jenjang"
                  ? "bg-[#0E7C3A] text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Target Jenjang SMP &amp; SMA
            </button>
          </div>

          {/* Tab 1: 4 Komponen Pembelajaran */}
          {activeTabKurikulum === "tahfizh" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-200">
              <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                <div className="inline-block px-3 py-1 rounded-lg bg-emerald-100 text-[#0E7C3A] font-extrabold text-xs">
                  1. SABAQ
                </div>
                <h3 className="text-lg font-bold text-slate-900 font-heading">Hafalan Baru</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Penambahan hafalan baru yang disetorkan setiap hari kepada musyrif halaqoh.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                <div className="inline-block px-3 py-1 rounded-lg bg-emerald-100 text-[#0E7C3A] font-extrabold text-xs">
                  2. SABQI
                </div>
                <h3 className="text-lg font-bold text-slate-900 font-heading">Hafalan Sepekan</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Murojaah hafalan yang diperoleh selama <strong>satu pekan terakhir</strong> secara intensif.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                <div className="inline-block px-3 py-1 rounded-lg bg-emerald-100 text-[#0E7C3A] font-extrabold text-xs">
                  3. MANZIL
                </div>
                <h3 className="text-lg font-bold text-slate-900 font-heading">Pekan Sebelumnya</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Murojaah hafalan pada pekan-pekan sebelumnya hingga mencapai akumulasi satu juz.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                <div className="inline-block px-3 py-1 rounded-lg bg-emerald-100 text-[#0E7C3A] font-extrabold text-xs">
                  4. MUFAR
                </div>
                <h3 className="text-lg font-bold text-slate-900 font-heading">Penjagaan Mutqin</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Murojaah harian sebanyak <strong>1–6 juz</strong> sesuai jumlah hafalan yang dimiliki santri guna menjaga kekuatan hafalan.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Alur Evaluasi Kenaikan Juz */}
          {activeTabKurikulum === "evaluasi" && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-heading">
                  Sistem Evaluasi Kenaikan Juz Santri
                </h3>
                <p className="text-sm text-slate-600">
                  Setiap santri wajib melewati 4 tahapan evaluasi sebelum diperbolehkan melanjutkan ke juz berikutnya:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-400">Tahap 1</span>
                  <p className="text-base font-bold text-slate-900">Setoran Rubu&apos;</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Evaluasi kelancaran tiap ¼ juz kepada musyrif halaqoh.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-400">Tahap 2</span>
                  <p className="text-base font-bold text-slate-900">Tasmi&apos; Satu Juz</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Membaca 1 juz penuh dalam sekali duduk di hadapan dewan halaqoh.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-emerald-700">Tahap 3</span>
                  <p className="text-base font-bold text-slate-900">Ikhtibar Tahap I</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ujian kelayakan resmi bersama <strong>Musyrif Tahfiz</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-emerald-700">Tahap 4 (Final)</span>
                  <p className="text-base font-bold text-slate-900">Ikhtibar Tahap II</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ujian pengesahan kenaikan juz bersama <strong>Mudir Tahfiz</strong>.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-[#0E7C3A] shrink-0" />
                  <span>Keputusan Resmi Ujian Ikhtibar Tahap II:</span>
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-xs sm:text-sm text-emerald-800 pl-1">
                  <li><strong>Lulus:</strong> Berhak melanjutkan setoran hafalan ke juz berikutnya.</li>
                  <li><strong>Mengulang sebagian:</strong> Murojaah intensif pada halaman atau maqra&apos; tertentu.</li>
                  <li><strong>Mengulang satu juz:</strong> Belum memenuhi standar kelulusan mutqin yang ditetapkan.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab 3: Target Jenjang Pendidikan */}
          {activeTabKurikulum === "jenjang" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-[#0E7C3A] flex items-center justify-center font-bold">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 font-heading">Jenjang SMP (Kelas VII–IX)</h3>
                    <p className="text-xs text-slate-500">Pondasi Adab, Tartil, &amp; Metode Al-Pakistani</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-sm">
                    <span className="font-semibold text-slate-700">Kelas VII</span>
                    <span className="font-bold text-[#0E7C3A]">Target 5–9 Juz</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-sm">
                    <span className="font-semibold text-slate-700">Kelas VIII</span>
                    <span className="font-bold text-[#0E7C3A]">Target 10–14 Juz</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-sm">
                    <span className="font-semibold text-slate-700">Kelas IX</span>
                    <span className="font-bold text-[#0E7C3A]">Target 15–20 Juz</span>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 font-heading">Jenjang SMA (Kelas X–XII)</h3>
                    <p className="text-xs text-slate-500">Penyempurnaan 30 Juz &amp; Kepemimpinan</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 text-sm text-slate-600 leading-relaxed">
                  <p>
                    • <strong>Target Capaian:</strong> Penyempurnaan hafalan hingga <strong>30 Juz Mutqin</strong>.
                  </p>
                  <p>
                    • <strong>Pendalaman:</strong> Penguatan ilmu-ilmu syar&apos;i, bahasa Arab, dan kepemimpinan santri.
                  </p>
                  <p>
                    • <strong>Program Pengabdian:</strong> Santri yang menyelesaikan jenjang SMA wajib mengikuti masa pengabdian dakwah dan pendidikan selama <strong>1 (satu) tahun</strong> sebelum melanjutkan ke perguruan tinggi.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. SECTION 3: JADWAL HARIAN RITMIK SANTRI (BAB V ALUR PENDIDIKAN) */}
      <section id="jadwal" className="scroll-mt-24 py-16 sm:py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0E7C3A] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Jadwal Baku Kegiatan
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
              Jadwal Harian Santri &amp; Materi Kepesantrenan Pekanan
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Disusun berdasarkan ritme kegiatan santri (Senin–Jumat) sesuai Bab V Buku Alur Pendidikan.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Jadwal Harian Senin-Jumat (2 Kolom) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 font-heading">
                <Clock className="h-5 w-5 text-[#0E7C3A]" />
                <span>Rangkaian Rutinitas Harian (Senin – Jumat)</span>
              </div>

              <div className="bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden divide-y divide-slate-200/80 text-sm">
                <div className="grid grid-cols-12 p-3 sm:p-4 font-semibold text-slate-600 bg-slate-100/80 text-xs sm:text-sm">
                  <div className="col-span-4 sm:col-span-3">Waktu (WITA)</div>
                  <div className="col-span-8 sm:col-span-9">Agenda &amp; Kegiatan Santri</div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">05.45 – 07.00</div>
                  <div className="col-span-8 sm:col-span-9 font-medium text-slate-800">
                    Halaqah Tahfiz (Sabaq, Sabqi, Manzil, Mufar)
                  </div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center bg-white">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">07.00 – 07.30</div>
                  <div className="col-span-8 sm:col-span-9 text-slate-700">Tambahan Setoran Sabaq</div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">07.30 – 09.00</div>
                  <div className="col-span-8 sm:col-span-9 text-slate-700">Sarapan, kebersihan diri, dan persiapan belajar</div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center bg-white">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">09.00 – 10.30</div>
                  <div className="col-span-8 sm:col-span-9 font-medium text-slate-800">Halaqah Tahfiz Pagi (Dhuha)</div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">10.30 – 13.00</div>
                  <div className="col-span-8 sm:col-span-9 text-slate-700">Shalat Dzuhur, makan siang, dan istirahat (qailulah)</div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center bg-white">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">13.00 – 15.00</div>
                  <div className="col-span-8 sm:col-span-9 font-medium text-slate-800">Halaqah Tahfiz Siang</div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">15.00 – 16.00</div>
                  <div className="col-span-8 sm:col-span-9 text-slate-700">Shalat Ashar berjamaah dan persiapan halaqah</div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center bg-white">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">16.00 – 17.00</div>
                  <div className="col-span-8 sm:col-span-9 font-medium text-slate-800">Halaqah Tahfiz Sore</div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">17.00 – 18.00</div>
                  <div className="col-span-8 sm:col-span-9 text-slate-700">Istirahat, kebersihan santri, dan persiapan Maghrib</div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center bg-white">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">18.30 – 19.30</div>
                  <div className="col-span-8 sm:col-span-9 font-bold text-[#0E7C3A]">Program Kepesantrenan Pekanan</div>
                </div>

                <div className="grid grid-cols-12 p-3 sm:p-4 items-center">
                  <div className="col-span-4 sm:col-span-3 font-mono font-bold text-slate-900">20.00 – 21.30</div>
                  <div className="col-span-8 sm:col-span-9 font-medium text-slate-800">Halaqah Tahfiz Malam (Ba&apos;da Isya)</div>
                </div>
              </div>

              <p className="text-xs text-slate-500 italic">
                * Catatan: Waktu pelaksanaan sholat fardhu menyesuaikan waktu sholat aktual wilayah Makassar (WITA) setiap harinya.
              </p>
            </div>

            {/* Mata Pelajaran Kepesantrenan Pekanan (1 Kolom) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 font-heading">
                <BookOpen className="h-5 w-5 text-emerald-700" />
                <span>Materi Kepesantrenan (18.30–19.30)</span>
              </div>

              <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="p-3 rounded-2xl bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-xs font-bold text-[#0E7C3A]">Senin</span>
                  <p className="text-sm font-bold text-slate-900">Bahasa Arab</p>
                  <p className="text-xs text-slate-500">Mufradat, Muhadatsah, Nahwu, Sharaf, &amp; Kitab Dasar</p>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-xs font-bold text-[#0E7C3A]">Selasa</span>
                  <p className="text-sm font-bold text-slate-900">Tafsir Al-Qur&apos;an</p>
                  <p className="text-xs text-slate-500">Tadabbur, makna ayat, &amp; asbābun nuzūl</p>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-xs font-bold text-[#0E7C3A]">Rabu</span>
                  <p className="text-sm font-bold text-slate-900">Fikih Ibadah &amp; Muamalah</p>
                  <p className="text-xs text-slate-500">Thaharah, shalat, puasa, &amp; praktik sehari-hari</p>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-xs font-bold text-[#0E7C3A]">Kamis</span>
                  <p className="text-sm font-bold text-slate-900">Aqidah Islamiyyah</p>
                  <p className="text-xs text-slate-500">Tauhid, rukun iman, &amp; pembentukan akhlak</p>
                </div>

                <div className="p-3 rounded-2xl bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-xs font-bold text-[#0E7C3A]">Jumat</span>
                  <p className="text-sm font-bold text-slate-900">Ilmu Tajwid</p>
                  <p className="text-xs text-slate-500">Makhārijul huruf &amp; kaidah bacaan tartil</p>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-500">Sabtu (08.00–15.30 WITA):</span>
                  <p className="text-xs text-slate-700 font-semibold mt-0.5">
                    Studi Umum: Matematika, Bahasa Inggris, &amp; Project Based Learning (IPA, IPS, TIK).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION 4: KALENDER KEGIATAN PUBLIK RESMI (TEMUAN 7) */}
      <section id="agenda" className="scroll-mt-24 py-16 sm:py-20 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0E7C3A] bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-300/80">
              Informasi Resmi Pesantren
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
              Kalender Agenda Publik
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Hanya menampilkan agenda kegiatan yang secara resmi disetujui untuk dipublikasikan bagi masyarakat, donatur, dan wali santri.
            </p>
          </div>

          {isAgendaLoading ? (
            <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-2">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-500 font-medium">Memuat agenda publik terverifikasi...</p>
            </div>
          ) : agendas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agendas.map((item) => (
                <div
                  key={item.id}
                  className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 text-[#0E7C3A] border border-emerald-200 text-xs font-bold">
                      {item.kategori}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 font-heading leading-snug">
                      {item.judul}
                    </h3>
                    {item.deskripsi && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {item.deskripsi}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{formatWitaDate(item.tanggalMulai)}</span>
                      {item.tanggalSelesai && (
                        <span> – {formatWitaDate(item.tanggalSelesai)}</span>
                      )}
                    </div>
                    {item.lokasi && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{item.lokasi}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200/90 text-center max-w-xl mx-auto space-y-3">
              <Calendar className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">
                Belum ada agenda yang dipublikasikan
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Agenda kegiatan resmi santri dan pesantren akan diperbarui berkala sesuai kalender pendidikan semester berjalan.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 7. SECTION 5: KONTAK & SEKRETARIAT RESMI */}
      <section id="kontak" className="scroll-mt-24 py-16 sm:py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0E7C3A] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Sekretariat &amp; Komunikasi
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
              Lokasi &amp; Kontak Resmi Lembaga
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Informasi alamat dan korespondensi resmi STQ Darul Ulum Cendekia dan Yayasan Infak Medika Nusantara.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-[#0E7C3A] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Alamat Sekretariat:</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mt-1">
                    {INSTITUTION_CONFIG.alamat}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-3 border-t border-slate-200">
                <Phone className="h-5 w-5 text-[#0E7C3A] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Kontak Resmi (Tata Usaha):</h3>
                  <p className="text-sm text-slate-600 mt-1 font-mono">
                    {INSTITUTION_CONFIG.telepon}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 rounded-3xl bg-emerald-900 text-white space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                  Portal Sistem Akademik
                </span>
                <h3 className="text-xl sm:text-2xl font-bold font-heading">
                  Masuk ke Portal STQ
                </h3>
                <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                  Bagi asatidz, pengurus yayasan, pimpinan pesantren, dan wali santri, silakan masuk ke dashboard melalui tombol di bawah.
                </p>
              </div>

              <Link
                href="/login"
                className="bg-white hover:bg-slate-100 text-[#0E7C3A] font-bold text-sm px-6 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-fit"
              >
                <LogIn className="h-4 w-4" />
                <span>Buka Formulir Masuk Portal</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FOOTER RESMI DENGAN LOGO GANDA */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-800 pb-8 text-center md:text-left">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-11 w-11 rounded-2xl bg-white p-1 shadow-xs shrink-0 flex items-center justify-center">
                  <img
                    src="/logo-yayasan.png"
                    alt="Logo Yayasan Infak Medika Nusantara - Alumni FKUH"
                    width={40}
                    height={40}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="h-11 w-11 rounded-2xl bg-white p-1 shadow-xs shrink-0 flex items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="Logo STQ Darul Ulum Cendekia"
                    width={40}
                    height={40}
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
              <div>
                <p className="font-extrabold text-base text-white font-heading">
                  {INSTITUTION_CONFIG.schoolName}
                </p>
                <p className="text-xs text-slate-400">
                  Yayasan Infak Medika Nusantara - Alumni FKUH
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-400 max-w-md md:text-right space-y-1">
              <p className="text-white font-semibold">Sekretariat:</p>
              <p className="leading-snug">{INSTITUTION_CONFIG.alamat}</p>
              <p className="text-emerald-400 font-medium">Telepon: {INSTITUTION_CONFIG.telepon}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 text-center sm:text-left">
            <p>
              © {new Date().getFullYear()} {INSTITUTION_CONFIG.name}. Seluruh Hak Cipta Dilindungi.
            </p>
            <p className="text-slate-400">
              Sekolah Tahfizh Berasrama Dhuafa &amp; Yatim Full Beasiswa
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
