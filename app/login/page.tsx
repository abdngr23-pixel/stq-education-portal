"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loginAction, quickDemoLoginAction } from "@/app/actions/auth";
import {
  Role,
  DEMO_ACCOUNTS,
  ALL_STAFF_ACCOUNTS,
  type StaffAccountItem,
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
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDemoRole, setSelectedDemoRole] = useState<string | null>(null);
  const [copiedRole, setCopiedRole] = useState<string | null>(null);

  // Controlled form values so users can autofill with 1 click
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

  const handleStaffLogin = (staff: StaffAccountItem) => {
    setErrorMessage(null);
    setSelectedDemoRole(staff.username);

    startTransition(async () => {
      const res = await quickDemoLoginAction(staff.username);
      if (res.success) {
        router.push("/");
        router.refresh();
      } else {
        setErrorMessage(res.message || `Gagal login sebagai ${staff.name}`);
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

  const handleStaffAutofill = (staff: StaffAccountItem) => {
    setUsername(staff.username);
    setPassword(staff.password);
    setCopiedRole(staff.username);
    setTimeout(() => setCopiedRole(null), 2000);
  };

  // Filter 10 roles by category
  const roleList = (Object.keys(DEMO_ACCOUNTS) as Role[]).filter((r) => {
    if (roleCategoryFilter === "ALL") return true;
    if (roleCategoryFilter === "LEADERSHIP") return ["KS", "ADM", "YAY"].includes(r);
    if (roleCategoryFilter === "TAHFIZH") return ["MT", "MK", "GA", "PH", "OSDA"].includes(r);
    if (roleCategoryFilter === "WALI") return ["WS", "ST"].includes(r);
    return false;
  });

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="max-w-6xl w-full mx-auto text-center mb-8 space-y-2">
        <div className="inline-flex h-20 w-20 rounded-3xl bg-white p-2.5 items-center justify-center shadow-md border border-slate-200/80 mb-1">
          <img src="/logo.png" alt={`Logo ${INSTITUTION_CONFIG.schoolName}`} width={70} height={70} className="h-full w-full object-contain" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-heading">
          STQ Education Portal — {INSTITUTION_CONFIG.shortName}
        </h1>
        <p className="text-sm font-semibold text-emerald-800">
          {INSTITUTION_CONFIG.schoolName}
        </p>
        <p className="text-xs text-slate-600 max-w-2xl mx-auto">
          {INSTITUTION_CONFIG.character} • {INSTITUTION_CONFIG.yayasanName}
        </p>
      </div>

      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sisi Kiri: Form Login Utama (5 Kolom) */}
        <div className="lg:col-span-5 space-y-4">
          <Card rounded="3xl" className="shadow-lg shadow-slate-200/50 p-6 sm:p-8 bg-white border border-slate-200/80">
            <CardHeader className="text-left pb-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E7C3A] bg-emerald-50 px-2.5 py-1 rounded-full w-fit mb-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                Autentikasi Terenkripsi JWT
              </div>
              <CardTitle className="text-lg md:text-xl font-bold font-heading">Masuk ke Akun</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Masukkan kredensial resmi atau gunakan tombol 1-klik akun di sebelah kanan.
              </CardDescription>
            </CardHeader>

            {errorMessage && (
              <div className="mb-5 p-3 rounded-2xl bg-red-50 border border-red-200/80 flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Username atau Email
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. mudir atau musyrif.tahfizh"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-[#0E7C3A] focus:ring-2 focus:ring-[#0E7C3A]/20 transition-all text-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kata Sandi (Password)
                  </label>
                  <span className="text-[11px] text-slate-400">Default: password123</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-[#0E7C3A] focus:ring-2 focus:ring-[#0E7C3A]/20 transition-all text-slate-900"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isPending && !selectedDemoRole}
                className="mt-2 min-h-[44px] bg-[#0E7C3A] hover:bg-[#0B642E] text-white font-bold"
                leftIcon={<LogIn className="h-4 w-4" />}
              >
                Masuk ke Portal
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Keamanan RBAC</span>
              <span className="font-semibold text-emerald-700">10 Role Terverifikasi</span>
            </div>
          </Card>

          {/* Quick Notice Card */}
          <div className="p-4 bg-emerald-50/70 rounded-3xl border border-emerald-200/70 text-xs text-emerald-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#C9990E]" />
              Pengujian Mandiri Multi-Role:
            </p>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              Klik <strong>&quot;Masuk Langsung&quot;</strong> pada salah satu kartu peran di sebelah kanan untuk segera mengeksplorasi antarmuka spesifik peran tersebut.
            </p>
          </div>
        </div>

        {/* Sisi Kanan: Katalog Akses 10 Role (7 Kolom) */}
        <div className="lg:col-span-7 space-y-4">
          <Card rounded="3xl" className="shadow-lg shadow-slate-200/50 p-6 bg-white border border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[#C9990E]" />
                  Katalog Akses Akun (10 Role Sistem)
                </h2>
                <p className="text-xs text-slate-500">
                  Pilih peran di bawah ini untuk menguji hak akses dan antarmuka masing-masing.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0 text-[11px]">
                <button
                  type="button"
                  onClick={() => setRoleCategoryFilter("ALL")}
                  className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                    roleCategoryFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Semua Peran
                </button>
                <button
                  type="button"
                  onClick={() => setRoleCategoryFilter("MUDHABBIR")}
                  className={`px-2.5 py-1 rounded-xl font-bold transition-all flex items-center gap-1 ${
                    roleCategoryFilter === "MUDHABBIR" ? "bg-[#0E7C3A] text-white shadow-xs" : "text-emerald-800 hover:text-emerald-950 font-bold"
                  }`}
                >
                  <BookOpen className="h-3 w-3" />
                  Mudhabbir &amp; Halaqoh (6)
                </button>
                <button
                  type="button"
                  onClick={() => setRoleCategoryFilter("LEADERSHIP")}
                  className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                    roleCategoryFilter === "LEADERSHIP" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Pimpinan &amp; TU
                </button>
                <button
                  type="button"
                  onClick={() => setRoleCategoryFilter("TAHFIZH")}
                  className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                    roleCategoryFilter === "TAHFIZH" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Asatidz &amp; Asrama
                </button>
                <button
                  type="button"
                  onClick={() => setRoleCategoryFilter("WALI")}
                  className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                    roleCategoryFilter === "WALI" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Wali &amp; Santri
                </button>
              </div>
            </div>

            {/* List Cards Role / Staff */}
            <div className="mt-4 space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {/* Jika filter MUDHABBIR atau TAHFIZH atau ALL: tampilkan akun Asatidz Mudhabbir */}
              {(roleCategoryFilter === "MUDHABBIR" || roleCategoryFilter === "ALL") && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1 pt-1 text-[11px] font-bold text-emerald-900">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5 text-[#0E7C3A]" />
                      Akun Asatidz Mudhabbir &amp; Musyrif Halaqoh (Binaan Riil):
                    </span>
                    <span className="text-[10px] text-slate-400">Total 57 Santri</span>
                  </div>

                  {ALL_STAFF_ACCOUNTS.map((staff) => {
                    const isSelectedPending = isPending && selectedDemoRole === staff.username;
                    const isFormCopied = copiedRole === staff.username;

                    return (
                      <div
                        key={staff.id}
                        className="p-3 sm:p-3.5 rounded-2xl bg-emerald-50/40 hover:bg-emerald-50/70 border border-emerald-200/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={staff.badgeVariant} size="sm" className="font-extrabold text-[11px] px-2 py-0.5">
                              {staff.role}
                            </Badge>
                            <span className="font-bold text-xs sm:text-sm text-slate-900 font-heading">
                              {staff.name}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                              {staff.santriCount} Santri
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="font-semibold text-emerald-950">{staff.halaqohName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                            <span>User: <strong className="text-slate-800">{staff.username}</strong></span>
                            <span>•</span>
                            <span>Pass: <strong className="text-slate-800">{staff.password}</strong></span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleStaffAutofill(staff)}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 transition-all flex items-center gap-1"
                            title="Isi otomatis formulir"
                          >
                            {isFormCopied ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-emerald-700 font-bold">Terisi</span>
                              </>
                            ) : (
                              "Isi Form"
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleStaffLogin(staff)}
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
                </div>
              )}

              {/* Tampilkan 10 Role Standar bila bukan khusus filter MUDHABBIR */}
              {roleCategoryFilter !== "MUDHABBIR" && (
                <>
                  {roleCategoryFilter === "ALL" && (
                    <div className="px-1 pt-3 text-[11px] font-bold text-slate-500">
                      Peran Sistem &amp; Manajemen:
                    </div>
                  )}
                  {roleList.map((r) => {
                    const acc = DEMO_ACCOUNTS[r];
                    const isSelectedPending = isPending && selectedDemoRole === r;
                    const isFormCopied = copiedRole === r;

                return (
                  <div
                    key={r}
                    className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/40 border border-slate-200/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={acc.badgeVariant} size="sm" className="font-extrabold text-[11px] px-2 py-0.5">
                          {acc.role}
                        </Badge>
                        <span className="font-bold text-xs sm:text-sm text-slate-900 font-heading">
                          {acc.roleTitle}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{acc.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                        <span>User: <strong className="text-slate-700">{acc.username}</strong></span>
                        <span>•</span>
                        <span>Pass: <strong className="text-slate-700">{acc.password}</strong></span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 max-w-md">
                        {acc.description}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleAutofill(r)}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 transition-all flex items-center gap-1"
                        title="Isi otomatis kredensial akun ini ke formulir di sebelah kiri"
                      >
                        {isFormCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Terisi</span>
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
              </>
            )}
          </div>
          </Card>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-6xl w-full mx-auto text-center mt-8 text-xs text-slate-400">
        © {new Date().getFullYear()} {INSTITUTION_CONFIG.name}. Dilindungi oleh Kebijakan Hak Akses Berjenjang (RBAC).
      </div>
    </div>
  );
}
