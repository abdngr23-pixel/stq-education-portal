"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loginAction, quickDemoLoginAction } from "@/app/actions/auth";
import {
  Role,
  DEMO_ACCOUNTS,
} from "@/types/auth";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";
import {
  Lock,
  User as UserIcon,
  Sparkles,
  AlertCircle,
  LogIn,
  KeyRound,
  ShieldCheck,
  Check,
  ArrowRight,
  UserCheck,
  BookOpen,
  HeartHandshake,
  Stethoscope,
  Calendar,
  Clock,
  Building2,
  MessageCircle,
  Utensils,
  Home,
  FileSpreadsheet,
  Compass,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDemoRole, setSelectedDemoRole] = useState<string | null>(null);
  const [copiedRole, setCopiedRole] = useState<string | null>(null);

  // Controlled form values
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [roleCategoryFilter, setRoleCategoryFilter] = useState<
    "ALL" | "LEADERSHIP" | "MUDHABBIR" | "TAHFIZH" | "WALI"
  >("ALL");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    startTransition(async () => {
      const res = await loginAction(formData);
      if (res.success) {
        router.push("/");
        router.refresh();
      } else {
        setErrorMessage(res.message || "Gagal melakukan autentikasi");
      }
    });
  };

  const handleDemoLogin = (role: Role) => {
    setErrorMessage(null);
    setSelectedDemoRole(role);

    startTransition(async () => {
      const res = await quickDemoLoginAction(role);
      if (res.success) {
        router.push("/");
        router.refresh();
      } else {
        setErrorMessage(res.message || `Gagal login sebagai ${role}`);
      }
    });
  };

  const handleAutofill = (demoRole: Role) => {
    const acc = DEMO_ACCOUNTS[demoRole];
    if (acc) {
      setUsername(acc.username);
      setPassword(acc.password);
      setCopiedRole(demoRole);
      setTimeout(() => setCopiedRole(null), 2000);
    }
  };

  // Filter roles by category
  const roleList = (Object.keys(DEMO_ACCOUNTS) as Role[]).filter((r) => {
    if (roleCategoryFilter === "ALL") return true;
    if (roleCategoryFilter === "LEADERSHIP") return ["KS", "ADM", "YAY"].includes(r);
    if (roleCategoryFilter === "TAHFIZH") return ["MT", "MK", "GA", "PH", "OSDA"].includes(r);
    if (roleCategoryFilter === "WALI") return ["WS", "ST"].includes(r);
    return false;
  });

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* 1. TOP STICKY NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 sm:h-13 sm:w-13 rounded-2xl bg-white p-1.5 shadow-xs border border-slate-200/80 shrink-0 flex items-center justify-center">
              <img
                src="/logo.png"
                alt={`Logo ${INSTITUTION_CONFIG.schoolName}`}
                width={48}
                height={48}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 font-heading tracking-tight">
                  {INSTITUTION_CONFIG.shortName}
                </span>
                <span className="hidden sm:inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#0E7C3A] border border-emerald-200/60">
                  Pesantren Tahfizh
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium line-clamp-1">
                {INSTITUTION_CONFIG.yayasanName}
              </p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => scrollToSection("profil-yayasan")}
              className="hover:text-[#0E7C3A] transition-colors"
            >
              Profil &amp; Yayasan
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("kurikulum-tahfizh")}
              className="hover:text-[#0E7C3A] transition-colors"
            >
              Ketahfidzhan &amp; Kurikulum
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("layanan-wali")}
              className="hover:text-[#0E7C3A] transition-colors"
            >
              Layanan Wali &amp; Asrama
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("agenda-santri")}
              className="hover:text-[#0E7C3A] transition-colors"
            >
              Kalender Kegiatan
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => scrollToSection("portal-login")}
              className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-xs sm:text-sm px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl shadow-xs gap-2 min-h-[40px] sm:min-h-[44px]"
            >
              <LogIn className="h-4 w-4" />
              <span>Masuk Portal</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 bg-gradient-to-b from-emerald-50/60 via-white to-slate-50 border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/70 border border-emerald-200 text-xs font-bold text-emerald-900 animate-in fade-in">
              <Sparkles className="h-4 w-4 text-[#0E7C3A]" />
              <span>Pusat Pendidikan Penghafal Al-Qur&apos;an &amp; Karakter Islami</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 font-heading tracking-tight leading-tight">
              Mencetak Generasi Qur&apos;ani yang Mutqin, Beradab Mulia, dan Berwawasan Cendekia
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              Sistem Informasi Manajemen Terpadu <strong>{INSTITUTION_CONFIG.schoolName}</strong> di bawah naungan <strong>{INSTITUTION_CONFIG.yayasanName}</strong>. Mengintegrasikan pencapaian tahfizh 30 Juz, pembinaan adab asrama 24 jam, pemantauan kesehatan santri di Poskestren, serta pelaporan berkala bagi donatur beasiswa dan wali santri.
            </p>

            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => scrollToSection("portal-login")}
                className="bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-md gap-2 min-h-[46px]"
              >
                <span>Masuk ke Portal Pengurus</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => scrollToSection("kurikulum-tahfizh")}
                className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm px-5 py-3 rounded-2xl border border-slate-200 min-h-[46px]"
              >
                <Compass className="h-4 w-4 text-[#0E7C3A]" />
                <span>Pelajari Kurikulum &amp; Program</span>
              </Button>
            </div>
          </div>

          {/* 4 HIGHLIGHT STAT CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12 sm:mt-16">
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2 hover:border-emerald-300 transition-all">
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-[#0E7C3A] flex items-center justify-center font-bold">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 font-heading">30 Juz</p>
                <p className="text-xs font-bold text-slate-700">Target Hafalan Mutqin</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Sabaq, Sabqi, Manzil, &amp; Ikhtibar</p>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2 hover:border-emerald-300 transition-all">
              <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 font-heading">5 Waktu</p>
                <p className="text-xs font-bold text-slate-700">Sholat Berjamaah di Shaf Pertama</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Disiplin adab &amp; mutaba&apos;ah asrama 24 jam</p>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2 hover:border-emerald-300 transition-all">
              <div className="h-10 w-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 font-heading">Orang Tua Asuh</p>
                <p className="text-xs font-bold text-slate-700">Beasiswa Santri Berprestasi</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Didukung Yayasan Infak Medika Nusantara</p>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2 hover:border-emerald-300 transition-all">
              <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 font-heading">100% Digital</p>
                <p className="text-xs font-bold text-slate-700">Pantauan Wali &amp; E-Rapor</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Laporan berkala transparan &amp; akurat</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SECTION 1: PROFIL & YAYASAN (FOKUS: YAYASAN & DONATUR) */}
      <section id="profil-yayasan" className="py-14 sm:py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10 space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0E7C3A] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Amanah &amp; Akuntabilitas Lembaga
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
              Sinergi {INSTITUTION_CONFIG.yayasanName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Menghadirkan tata kelola pendidikan ketahfidzhan yang profesional, transparan, dan berkelanjutan bagi umat.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="h-10 w-10 rounded-2xl bg-[#0E7C3A] text-white flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Legalitas &amp; Visi Masa Depan
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                STQ Darul Ulum Cendekia bernaung di bawah Yayasan Infak Medika Nusantara dengan komitmen kuat mendidik santri penghafal Al-Qur&apos;an yang memiliki kedalaman ilmu syar&apos;i, adab santri yang unggul, dan kepedulian sosial tinggi.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Program Orang Tua Asuh (OTA)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Menjembatani donatur dan muhsinin dengan santri-santri binaan berprestasi. Infak beasiswa dikelola secara amanah dan tersalurkan tepat sasaran untuk pembiayaan makan santri, akomodasi asrama, dan bimbingan tahfizh intensif.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="h-10 w-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center">
                <MessageCircle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Laporan WhatsApp Berkala Donatur
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Donatur Orang Tua Asuh secara otomatis menerima rangkuman perkembangan mutaba&apos;ah santri asuh melalui WhatsApp Direct resmi, mencakup capaian juz hafalan, status kelancaran, dan catatan pembina halaqoh.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SECTION 2: KETAHFIDZHAN & KURIKULUM (FOKUS: PENGURUS PENDIDIKAN & ASATIDZ) */}
      <section id="kurikulum-tahfizh" className="py-14 sm:py-20 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10 space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0E7C3A] bg-emerald-100/70 px-3 py-1 rounded-full border border-emerald-200">
              Standar Mutu Pembelajaran
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
              Metode 4 Pilar Ketahfidzhan &amp; Kurikulum Berimbang
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Sistem ketahfidzhan teruji yang mengedepankan kualitas bacaan tartil, mutqin hafalan, dan pemahaman diniyyah yang kokoh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="inline-block px-2.5 py-1 rounded-xl bg-emerald-50 text-[#0E7C3A] font-black text-xs">
                Pilar 1
              </div>
              <h3 className="text-base font-bold text-slate-900 font-heading">Sabaq (Ziyadah)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Setoran hafalan baru setiap hari dengan bimbingan makharijul huruf dan sifatul huruf secara talaqqi bersama Musyrif Halaqoh.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="inline-block px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 font-black text-xs">
                Pilar 2
              </div>
              <h3 className="text-base font-bold text-slate-900 font-heading">Sabqi (Penguatan)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pengulangan 1–5 halaman yang baru dihafal dalam 2 pekan terakhir untuk mengunci hafalan sebelum melangkah ke juz berikutnya.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="inline-block px-2.5 py-1 rounded-xl bg-sky-50 text-sky-700 font-black text-xs">
                Pilar 3
              </div>
              <h3 className="text-base font-bold text-slate-900 font-heading">Manzil (Muroja&apos;ah)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Muroja&apos;ah berkala seluruh juz lama yang telah tuntas dihafal agar hafalan tetap menancap kuat dan tidak mudah hilang.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="inline-block px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 font-black text-xs">
                Pilar 4
              </div>
              <h3 className="text-base font-bold text-slate-900 font-heading">Ikhtibar (Ujian)</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ujian kelayakan dua tahap: Tahap 1 oleh Musyrif Halaqoh dan Tahap 2 oleh Penguji Independen untuk memastikan standar kelancaran.
              </p>
            </div>
          </div>

          {/* RITMIK KEGIATAN KESANTRIAN 24 JAM */}
          <div className="mt-10 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[#0E7C3A]" />
                  Ritmik Harian Santri 24 Jam (Pedoman Pesantren Bab V)
                </h3>
                <p className="text-xs text-slate-500">
                  Disiplin waktu dan pembiasaan adab islami yang terstruktur dari bangun tidur hingga istirahat malam
                </p>
              </div>
              <Badge variant="gold" size="sm" className="font-bold self-start sm:self-center">
                Waktu Indonesia Tengah (WITA)
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-mono font-bold text-[#0E7C3A]">03.30 – 05.00</span>
                <p className="font-bold text-slate-800">Qiyamul Lail &amp; Sholat Subuh</p>
                <p className="text-slate-500">Tahajjud berjamaah, dzikir pagi, dan mutaba&apos;ah shaf pertama.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-mono font-bold text-[#0E7C3A]">05.00 – 06.30</span>
                <p className="font-bold text-slate-800">Halaqoh Tahfizh Pagi</p>
                <p className="text-slate-500">Setoran Sabaq hafalan baru kepada Musyrif Halaqoh.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-mono font-bold text-[#0E7C3A]">07.30 – 11.45</span>
                <p className="font-bold text-slate-800">Pembelajaran Diniyyah &amp; Umum</p>
                <p className="text-slate-500">Bahasa Arab, Fiqih, Hadits Arba&apos;in, dan studi umum terapan.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-mono font-bold text-[#0E7C3A]">12.00 – 14.00</span>
                <p className="font-bold text-slate-800">Dzuhur &amp; Qailulah</p>
                <p className="text-slate-500">Sholat Dzuhur berjamaah, makan siang gizi seimbang, dan tidur siang sunnah.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-mono font-bold text-[#0E7C3A]">15.30 – 17.00</span>
                <p className="font-bold text-slate-800">Ashar &amp; Muroja&apos;ah Mandiri</p>
                <p className="text-slate-500">Sholat Ashar berjamaah dan pengulangan Sabqi di serambi masjid.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-mono font-bold text-[#0E7C3A]">18.00 – 19.30</span>
                <p className="font-bold text-slate-800">Maghrib &amp; Halaqoh Malam</p>
                <p className="text-slate-500">Muroja&apos;ah Manzil hafalan lama dan tasmi&apos; berpasangan.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-mono font-bold text-[#0E7C3A]">19.30 – 21.00</span>
                <p className="font-bold text-slate-800">Isya &amp; Makan Malam</p>
                <p className="text-slate-500">Sholat Isya berjamaah, makan malam bersama, dan pengarahan asrama.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="font-mono font-bold text-[#0E7C3A]">21.30 – 03.30</span>
                <p className="font-bold text-slate-800">Adab Istirahat Malam</p>
                <p className="text-slate-500">Wudhu sebelum tidur, membaca doa/dzikir tidur, dan istirahat asrama.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SECTION 3: PENGASUHAN & LAYANAN (FOKUS: WALI SANTRI) */}
      <section id="layanan-wali" className="py-14 sm:py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10 space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0E7C3A] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Ketenangan &amp; Kepercayaan Wali Santri
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
              Layanan Pengasuhan &amp; Ekosistem Asrama Sehat
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Menjaga amanah para orang tua dengan memastikan santri tumbuh sehat jasmani, bersih adabnya, dan terpantau perkembangannya.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center">
                <Stethoscope className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Poskestren UKS Terintegrasi
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pencatatan rekam medis santri saat mengeluh sakit, observasi di kamar UKS pondok, dan rujukan cepat ke Puskesmas atau Rumah Sakit mitra dengan pemberitahuan transparan kepada wali santri.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center">
                <Utensils className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Katering Dapur Gizi Sehat
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pengelolaan logistik makanan higienis dengan menu variatif 3 kali sehari, dilengkapi lauk bergizi, sayur mayur segar, dan buah berkala untuk mendukung kebugaran santri saat berinteraksi dengan Al-Qur&apos;an.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="h-10 w-10 rounded-2xl bg-[#0E7C3A] text-white flex items-center justify-center">
                <MessageCircle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Kotak Saran &amp; e-Rapor Transparan
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Wali santri dapat menyampaikan masukan langsung melalui portal kotak saran ke Mudir, serta memantau mutaba&apos;ah bulanan, perizinan kepulangan, dan mengunduh Rapor Digital resmi setiap semester.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION 4: AGENDA & KALENDER KEGIATAN */}
      <section id="agenda-santri" className="py-14 sm:py-20 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10 space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0E7C3A] bg-emerald-100/70 px-3 py-1 rounded-full border border-emerald-200">
              Agenda &amp; Jadwal Mendatang
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-heading">
              Kalender Kegiatan Akademik &amp; Santri
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Rangkaian agenda kegiatan pesantren yang terjadwal rapi untuk panduan pengurus, asatidz, dan wali santri.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <Badge variant="green" size="sm" className="font-bold">
                Ketahfidzhan
              </Badge>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                Ujian Ikhtibar Semester Ganjil
              </h3>
              <div className="text-xs text-slate-500 space-y-1">
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#0E7C3A]" />
                  <span>15 – 20 September 2026</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-slate-400" />
                  <span>Masjid Utama Pesantren</span>
                </p>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <Badge variant="gold" size="sm" className="font-bold">
                Kegiatan Santri
              </Badge>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                Rihlah Tarbawiyah &amp; Camping Qur&apos;ani
              </h3>
              <div className="text-xs text-slate-500 space-y-1">
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#0E7C3A]" />
                  <span>01 – 03 Oktober 2026</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-slate-400" />
                  <span>Bumi Perkemahan Mandiri</span>
                </p>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <Badge variant="purple" size="sm" className="font-bold">
                Pertemuan Wali
              </Badge>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                Pertemuan Evaluasi Wali Santri &amp; Mudir
              </h3>
              <div className="text-xs text-slate-500 space-y-1">
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#0E7C3A]" />
                  <span>18 Oktober 2026</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-slate-400" />
                  <span>Aula STQ Darul Ulum Cendekia</span>
                </p>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <Badge variant="neutral" size="sm" className="font-bold">
                Libur Terjadwal
              </Badge>
              <h3 className="text-sm font-bold text-slate-900 font-heading">
                Libur Kepulangan Tengah Semester
              </h3>
              <div className="text-xs text-slate-500 space-y-1">
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#0E7C3A]" />
                  <span>24 – 28 Oktober 2026</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-slate-400" />
                  <span>Kompleks Asrama Pondok</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SECTION 5: PORTAL LOGIN PENGURUS & CIVITAS (DI BAGIAN BAWAH) */}
      <section
        id="portal-login"
        className="py-16 sm:py-24 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white scroll-mt-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-xs font-bold text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Autentikasi Terenkripsi &amp; Role-Based Access Control (RBAC)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black font-heading tracking-tight text-white">
              Portal Masuk Civitas &amp; Pengurus STQ
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Silakan masukkan kredensial resmi Anda untuk mengakses dashboard operasional, input data kesantrian, penilaian akademik, atau mutaba&apos;ah wali santri.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Login Utama (5 Kolom) */}
            <div className="lg:col-span-5 space-y-4">
              <Card rounded="3xl" className="shadow-2xl p-6 sm:p-8 bg-slate-800/90 border border-slate-700/80 backdrop-blur-sm text-white">
                <CardHeader className="text-left pb-4 px-0 pt-0">
                  <CardTitle className="text-lg md:text-xl font-bold font-heading text-white">
                    Masuk Akun Pengguna
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Masukkan Username / NIS dan kata sandi terdaftar Anda
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-0 pb-0">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMessage && (
                      <div
                        role="alert"
                        className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-200 flex items-start gap-2.5 text-xs animate-in fade-in"
                      >
                        <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <div className="flex-1 font-medium">{errorMessage}</div>
                      </div>
                    )}

                    <div className="space-y-1.5 text-left">
                      <label htmlFor="username" className="block text-xs font-bold text-slate-300">
                        Username atau NIS Santri
                      </label>
                      <div className="relative">
                        <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          id="username"
                          name="username"
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Contoh: mudir.ks atau SAN-0001"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-600 bg-slate-900/90 text-white placeholder:text-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0E7C3A] transition-all min-h-[44px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label htmlFor="password" className="block text-xs font-bold text-slate-300">
                        Kata Sandi
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          id="password"
                          name="password"
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Masukkan kata sandi..."
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-600 bg-slate-900/90 text-white placeholder:text-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0E7C3A] transition-all min-h-[44px]"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isPending}
                      className="w-full bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold text-sm py-3 rounded-xl shadow-md transition-all gap-2 min-h-[46px]"
                    >
                      {isPending ? (
                        <>
                          <span className="animate-pulse">Memverifikasi Sesi...</span>
                        </>
                      ) : (
                        <>
                          <LogIn className="h-4 w-4" />
                          <span>Masuk ke Dashboard</span>
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="mt-6 pt-4 border-t border-slate-700/80 text-center text-xs text-slate-400">
                    Mengalami kendala masuk atau lupa kata sandi? Silakan hubungi bagian Tata Usaha Pesantren.
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Akses Cepat Evaluasi Peran / Demo Switcher (7 Kolom) */}
            <div className="lg:col-span-7 space-y-4">
              <Card rounded="3xl" className="shadow-2xl p-6 sm:p-8 bg-slate-800/80 border border-slate-700/80 backdrop-blur-sm text-white">
                <CardHeader className="text-left pb-4 px-0 pt-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base sm:text-lg font-bold font-heading text-white flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-amber-400" />
                        Pintasan Masuk Peran (Mode Evaluasi)
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400">
                        Pilih peran di bawah untuk menguji alur kerja masing-masing pengguna secara langsung
                      </CardDescription>
                    </div>
                  </div>

                  {/* Filter Kategori Peran */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-3">
                    <button
                      type="button"
                      onClick={() => setRoleCategoryFilter("ALL")}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all ${
                        roleCategoryFilter === "ALL"
                          ? "bg-[#0E7C3A] text-white shadow-xs"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      Semua Akun
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleCategoryFilter("LEADERSHIP")}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all ${
                        roleCategoryFilter === "LEADERSHIP"
                          ? "bg-[#0E7C3A] text-white shadow-xs"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      Pimpinan (KS/ADM/YAY)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleCategoryFilter("MUDHABBIR")}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all ${
                        roleCategoryFilter === "MUDHABBIR"
                          ? "bg-[#0E7C3A] text-white shadow-xs"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      Asatidz &amp; Guru
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleCategoryFilter("WALI")}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all ${
                        roleCategoryFilter === "WALI"
                          ? "bg-[#0E7C3A] text-white shadow-xs"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      Wali &amp; Santri
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="px-0 pb-0 max-h-[460px] overflow-y-auto pr-1 space-y-2.5">
                  {roleList.map((r) => {
                    const acc = DEMO_ACCOUNTS[r];
                    const isSelectedPending = isPending && selectedDemoRole === r;
                    const isFormCopied = copiedRole === r;

                    return (
                      <div
                        key={r}
                        className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={acc.badgeVariant} size="sm" className="font-extrabold text-[10px] px-2 py-0.5">
                              {acc.role}
                            </Badge>
                            <span className="font-bold text-xs sm:text-sm text-white font-heading">
                              {acc.roleTitle}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span>{acc.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                            <span>User: <strong className="text-emerald-300">{acc.username}</strong></span>
                            <span>•</span>
                            <span>Pass: <strong className="text-emerald-300">{acc.password}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleAutofill(r)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-slate-200 transition-all flex items-center gap-1"
                            title="Isi otomatis kredensial akun ini ke formulir di sebelah kiri"
                          >
                            {isFormCopied ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-emerald-300 font-bold">Terisi</span>
                              </>
                            ) : (
                              "Isi Form"
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDemoLogin(r)}
                            className="px-3 py-1.5 rounded-xl bg-[#0E7C3A] hover:bg-[#0B642E] text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 min-h-[34px]"
                          >
                            {isSelectedPending ? (
                              <span className="animate-pulse">Masuk...</span>
                            ) : (
                              <>
                                <span>Masuk Langsung</span>
                                <ArrowRight className="h-3 w-3" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FOOTER RESMI */}
      <footer className="bg-slate-950 text-slate-400 py-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-8 text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white p-1 shadow-xs shrink-0 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt={`Logo ${INSTITUTION_CONFIG.schoolName}`}
                  width={36}
                  height={36}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="font-extrabold text-sm text-white font-heading">
                  {INSTITUTION_CONFIG.schoolName}
                </p>
                <p className="text-xs text-slate-400">
                  {INSTITUTION_CONFIG.yayasanName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 max-w-md">
              Sistem Informasi Pendidikan Ketahfidzhan &amp; Manajemen Kesantrian Berbasis Syari&apos;ah dan Nilai Kepesantrenan.
            </p>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 text-center sm:text-left">
            <p>
              © {new Date().getFullYear()} {INSTITUTION_CONFIG.name}. Dilindungi oleh Kebijakan Hak Akses Berjenjang (RBAC).
            </p>
            <p className="text-slate-400 font-semibold">
              Karakter: {INSTITUTION_CONFIG.character}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
