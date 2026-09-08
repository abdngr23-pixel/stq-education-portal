"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction, quickDemoLoginAction } from "@/app/actions/auth";
import { Role, DEMO_ACCOUNTS } from "@/types/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Lock,
  User,
  LogIn,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";
import { DemoAccountSwitcher } from "@/components/auth/demo-account-switcher";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDemoRole, setSelectedDemoRole] = useState<Role | null>(null);
  const [copiedRole, setCopiedRole] = useState<Role | null>(null);

  // Controlled form values
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Hanya aktif di lingkungan demonstrasi / development (Temuan 2 Remediasi)
  const isDemoEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_DEMO === "true";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    const formData = new FormData();
    formData.append("username", username.trim());
    formData.append("password", password);

    startTransition(async () => {
      const res = await loginAction(formData);
      if (res.success) {
        router.push("/");
        router.refresh();
      } else {
        setErrorMessage(res.message || "Nama pengguna atau kata sandi tidak valid.");
      }
    });
  };

  const handleDemoLogin = (role: Role) => {
    if (!isDemoEnabled) return;
    setErrorMessage(null);
    setSelectedDemoRole(role);

    startTransition(async () => {
      const res = await quickDemoLoginAction(role);
      if (res.success) {
        router.push("/");
        router.refresh();
      } else {
        setErrorMessage(res.message || `Gagal masuk simulasi sebagai ${role}`);
      }
    });
  };

  const handleAutofill = (demoRole: Role) => {
    if (!isDemoEnabled) return;
    const acc = DEMO_ACCOUNTS[demoRole];
    if (acc) {
      setUsername(acc.username);
      setPassword(acc.password);
      setCopiedRole(demoRole);
      setTimeout(() => setCopiedRole(null), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-[#0E7C3A]/30 selection:text-white font-sans">
      {/* 1. TOP HEADER & TAUTAN KEMBALI KE PROFIL PUBLIK */}
      <header className="w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <Link href="/profil" className="flex items-center gap-3 group">
            <div className="flex items-center gap-2">
              <div className="h-11 w-11 rounded-2xl bg-white p-1 shadow-xs flex items-center justify-center shrink-0">
                <img
                  src="/logo-yayasan.png"
                  alt="Logo Yayasan Infak Medika Nusantara"
                  width={36}
                  height={36}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="h-11 w-11 rounded-2xl bg-white p-1 shadow-xs flex items-center justify-center shrink-0">
                <img
                  src="/logo.png"
                  alt={`Logo ${INSTITUTION_CONFIG.schoolName}`}
                  width={36}
                  height={36}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base text-white font-heading block group-hover:text-emerald-400 transition-colors leading-tight">
                {INSTITUTION_CONFIG.schoolName}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Portal Sistem Informasi Manajemen
              </span>
            </div>
          </Link>

          <Link
            href="/profil"
            className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Kembali ke Profil Sekolah</span>
            <span className="sm:hidden">Profil</span>
          </Link>
        </div>
      </header>

      {/* 2. AREA FORMULIR MASUK RINGKAS (FOKUS & CEPAT) */}
      <main className="flex-1 flex items-center justify-center py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className={`w-full ${isDemoEnabled ? "max-w-6xl" : "max-w-md"} mx-auto`}>
          <div className={isDemoEnabled ? "grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" : "w-full"}>
            
            {/* FORM LOGIN RESMI (PRODUKSI & DEMO) */}
            <div className={isDemoEnabled ? "lg:col-span-5" : "w-full"}>
              <Card rounded="3xl" className="shadow-2xl p-6 sm:p-8 bg-slate-900/90 border border-slate-800 backdrop-blur-md text-white space-y-6">
                <CardHeader className="text-left pb-2 px-0 pt-0 space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold w-fit">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Autentikasi Terenkripsi (RBAC)</span>
                  </div>
                  <CardTitle className="text-2xl font-bold font-heading text-white">
                    Masuk ke Dashboard
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 leading-relaxed">
                    Masukkan nama pengguna/NIS dan kata sandi terdaftar untuk mengakses hak kelola Anda.
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-0 pb-0 space-y-5">
                  {errorMessage && (
                    <div
                      role="alert"
                      aria-live="polite"
                      className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150"
                    >
                      <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{errorMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5 text-left">
                      <label htmlFor="username" className="block text-xs font-bold text-slate-300">
                        Nama Pengguna / NIS Santri
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          id="username"
                          name="username"
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Contoh: razan.mt atau SAN-0001"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0E7C3A] transition-all min-h-[44px]"
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
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0E7C3A] transition-all min-h-[44px]"
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
                        <span className="animate-pulse">Memverifikasi Sesi...</span>
                      ) : (
                        <>
                          <LogIn className="h-4 w-4" />
                          <span>Masuk ke Dashboard</span>
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="pt-4 border-t border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      Mengalami kendala akun? Silakan hubungi Tata Usaha di{" "}
                      <span className="font-mono text-emerald-400 font-semibold">{INSTITUTION_CONFIG.telepon}</span>
                    </p>
                    <div>
                      <Link
                        href="/profil"
                        className="text-xs text-slate-400 hover:text-emerald-400 transition-colors inline-block pt-1"
                      >
                        ← Kembali ke Halaman Profil Sekolah
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* PANEL SIMULASI PERAN DEMO (HANYA MUNCUL DI LINGKUNGAN DEMO / DEV) */}
            {isDemoEnabled && (
              <div className="lg:col-span-7">
                <DemoAccountSwitcher
                  onSelectRole={handleDemoLogin}
                  onAutofill={handleAutofill}
                  isPending={isPending}
                  selectedRole={selectedDemoRole}
                  copiedRole={copiedRole}
                />
              </div>
            )}

          </div>
        </div>
      </main>

      {/* 3. FOOTER RESMI RINGKAS */}
      <footer className="w-full border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 px-4">
        <p>
          © {new Date().getFullYear()} {INSTITUTION_CONFIG.name}. Dikelola Yayasan Infak Medika Nusantara - Alumni FKUH.
        </p>
      </footer>
    </div>
  );
}
