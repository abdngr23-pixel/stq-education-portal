"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Role } from "@/types/auth";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Clock,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  PlusCircle,
  X,
  MapPin,
  Filter,
} from "lucide-react";

export interface AgendaItem {
  id: string;
  judul: string;
  tanggal: string;
  kategori: string;
  lokasi: string;
}

export interface KalenderModuleProps {
  agendaList: AgendaItem[];
  userRole: Role;
  onTambahAgenda: (data: { judul: string; tanggal: string; kategori: string; lokasi: string }) => Promise<void> | void;
  isPending?: boolean;
}

export function KalenderModule({
  agendaList,
  userRole,
  onTambahAgenda,
  isPending = false,
}: KalenderModuleProps) {
  const [subTab, setSubTab] = useState<"ritmik" | "kalender">("ritmik");
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterKategori, setFilterKategori] = useState<string>("ALL");

  // Form states inside modal
  const [judul, setJudul] = useState("");
  const [tanggal, setTanggal] = useState("2026-09-25");
  const [kategori, setKategori] = useState("TAHFIZH");
  const [lokasi, setLokasi] = useState("Kompleks Pondok STQ DUC");
  const [formError, setFormError] = useState("");

  const canAddAgenda = userRole === "ADM" || userRole === "KS";

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim()) {
      setFormError("Judul agenda wajib diisi.");
      return;
    }
    setFormError("");
    await onTambahAgenda({ judul: judul.trim(), tanggal, kategori, lokasi });
    setJudul("");
    setShowAddModal(false);
  };

  const filteredAgendas = agendaList.filter((item) => {
    if (filterKategori === "ALL") return true;
    return item.kategori === filterKategori;
  });

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-heading">
            Kalender & Jadwal Ritmik
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pola ritmik harian santri (Bab V) dan agenda kalender resmi {INSTITUTION_CONFIG.shortName}
          </p>
        </div>

        {/* Action button */}
        {subTab === "kalender" && canAddAgenda && (
          <Button
            onClick={() => setShowAddModal(true)}
            leftIcon={<PlusCircle className="h-4 w-4" />}
            size="sm"
          >
            Tambah Agenda
          </Button>
        )}
      </div>

      {/* Sub-tab Pill Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl w-fit border border-slate-200/80">
        <button
          type="button"
          onClick={() => setSubTab("ritmik")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px]",
            subTab === "ritmik"
              ? "bg-[#0E7C3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          Jadwal Harian Ritmik Santri (Bab V)
        </button>
        <button
          type="button"
          onClick={() => setSubTab("kalender")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[40px]",
            subTab === "kalender"
              ? "bg-[#0E7C3A] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          Kalender Kegiatan & Agenda
        </button>
      </div>

      {/* SUB-VIEW 1: JADWAL RITMIK */}
      {subTab === "ritmik" && (
        <div className="space-y-6">
          <Card rounded="3xl" className="border border-emerald-200/60 bg-gradient-to-r from-emerald-50/60 via-white to-white">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[#0E7C3A]" />
                  <CardTitle className="text-base sm:text-lg">
                    Pola Ritmik Harian Santri — {INSTITUTION_CONFIG.shortName}
                  </CardTitle>
                </div>
                <Badge variant="green" size="md">Standar Kurikulum Resmi</Badge>
              </div>
              <CardDescription>
                Pola ritmik harian terpadu: 5 waktu Halaqah Tahfiz Al-Qur&apos;an (Metode Al-Pakistani), Kajian Diniyah Malam, dan Studi Umum / PBL Sabtu.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Kolom 1 & 2: Senin - Jumat */}
            <div className="lg:col-span-2 space-y-4">
              <Card rounded="3xl">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-[#0E7C3A] flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> Senin s.d. Jumat (Tahfiz &amp; Kepesantrenan)
                    </CardTitle>
                    <Badge variant="green" size="sm">Halaqah Utama</Badge>
                  </div>
                  <CardDescription>
                    Alur intensif 5 waktu halaqah Al-Qur&apos;an &amp; kajian diniyah malam
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="relative border-l-2 border-emerald-200 ml-3 space-y-3 text-xs">
                    {[
                      { jam: "03.30 – 04.30", judul: "Qiyamul Lail & Sahur", desc: "Shalat Tahajjud mandiri/berjamaah & sahur puasa sunnah (Senin/Kamis)", badge: "Ibadah Malam" },
                      { jam: "04.30 – 05.45", judul: "Shalat Shubuh & Dzikir Pagi", desc: "Shalat berjamaah di masjid, dzikir Al-Ma'tsurat, dan persiapan halaqah", badge: "Masjid" },
                      { jam: "05.45 – 07.00", judul: "Halaqah Tahfiz Pagi (Sabaq, Sabqi, Manzil, Mufar)", desc: "Setoran hafalan baru (Sabaq) dan penguatan hafalan kemarin (Sabqi)", badge: "Halaqah 1", hl: true },
                      { jam: "07.00 – 07.30", judul: "Tambahan Setoran Sabaq", desc: "Bimbingan intensif bagi santri yang membutuhkan perbaikan tajwid/kelancaran", badge: "Bimbingan" },
                      { jam: "07.30 – 09.00", judul: "Sarapan Pagi, Piket & MCK", desc: "Makan pagi bersama, piket kebersihan asrama/kamar, persiapan mandi", badge: "Asrama" },
                      { jam: "09.00 – 10.30", judul: "Halaqah Tahfiz Dhuha & Shalat Dhuha", desc: "Ziyadah hafalan baru serta sholat sunnah dhuha di masjid", badge: "Halaqah 2", hl: true },
                      { jam: "10.30 – 13.00", judul: "Zhuhur, Makan Siang & Qailulah", desc: "Shalat Zhuhur berjamaah, makan siang gizi seimbang, dan tidur siang (sunnah qailulah)", badge: "Istirahat" },
                      { jam: "13.00 – 15.00", judul: "Halaqah Tahfiz Siang", desc: "Murojaah Manzil (penguatan juz-juz lama agar mutqin)", badge: "Halaqah 3", hl: true },
                      { jam: "15.00 – 16.00", judul: "Shalat Ashar & Dzikir Petang", desc: "Shalat Ashar berjamaah dan pembacaan wirid/dzikir petang", badge: "Masjid" },
                      { jam: "16.00 – 17.00", judul: "Halaqah Tahfiz Sore", desc: "Mufar (sima'an berpasangan antar-santri & pemantapan hafalan)", badge: "Halaqah 4", hl: true },
                      { jam: "17.00 – 18.00", judul: "Istirahat Sore, Mandi & MCK", desc: "Aktivitas mandiri, mandi sore, dan persiapan menuju masjid", badge: "Asrama" },
                      { jam: "18.00 – 18.30", judul: "Shalat Maghrib Berjamaah", desc: "Shalat Maghrib berjamaah dan tilawah Al-Qur'an menjelang kajian", badge: "Masjid" },
                      { jam: "18.30 – 19.30", judul: "Program Kepesantrenan (Senin–Jumat)", desc: "Senin: B. Arab • Selasa: Tafsir • Rabu: Fikih • Kamis: Aqidah • Jumat: Tajwid", badge: "Kajian Diniyah", hl: true },
                      { jam: "19.30 – 20.00", judul: "Shalat Isya & Makan Malam", desc: "Shalat Isya berjamaah dilanjutkan makan malam bersama", badge: "Masjid & Dapur" },
                      { jam: "20.00 – 21.30", judul: "Halaqah Tahfiz Malam / Murojaah Mandiri", desc: "Persiapan setoran sabaq esok hari di bawah bimbingan musyrif/mudhabbir", badge: "Halaqah 5", hl: true },
                      { jam: "21.30 – 03.30", judul: "Istirahat Malam (Jam Wajib Tidur)", desc: "Lampu asrama dipadamkan, istirahat malam teratur demi stamina menghafal", badge: "Tidur Asrama" },
                    ].map((item, idx) => (
                      <div key={idx} className="relative pl-6">
                        <div
                          className={cn(
                            "absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 bg-white",
                            item.hl ? "border-emerald-600 bg-emerald-500" : "border-slate-300"
                          )}
                        />
                        <div
                          className={cn(
                            "p-3 rounded-2xl border",
                            item.hl ? "bg-emerald-50/40 border-emerald-200" : "bg-white border-slate-200/70"
                          )}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-bold text-slate-800 text-xs">{item.judul}</span>
                              <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono text-[11px] font-bold text-emerald-800 block">{item.jam}</span>
                              <Badge variant={item.hl ? "green" : "neutral"} size="sm">{item.badge}</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Kolom 3: Sabtu PBL & Ahad Mandiri */}
            <div className="space-y-6">
              {/* Sabtu: Studi Umum & PBL */}
              <Card rounded="3xl" className="border border-sky-200/80">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-sky-800 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" /> Sabtu: Studi Umum &amp; PBL
                    </CardTitle>
                    <Badge variant="sky" size="sm">08.00–15.30 WITA</Badge>
                  </div>
                  <CardDescription>Pemenuhan kurikulum nasional &amp; proyek berbasis masalah</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-800">08.00 – 09.30 WITA</span>
                      <Badge variant="sky" size="sm">Mapel Tetap</Badge>
                    </div>
                    <p className="font-semibold text-sky-900">Matematika Terapan</p>
                    <p className="text-[11px] text-slate-600">Pengampu: Ustzh. Nurul Hidayah, S.Pd.</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-800">09.30 – 11.00 WITA</span>
                      <Badge variant="sky" size="sm">Mapel Tetap</Badge>
                    </div>
                    <p className="font-semibold text-sky-900">Bahasa Inggris (Komunikasi &amp; Gramatika)</p>
                    <p className="text-[11px] text-slate-600">Pengampu: Ustzh. Nurul Hidayah, S.Pd.</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-800">11.00 – 12.30 WITA</span>
                      <Badge variant="green" size="sm">PBL Sesi 1</Badge>
                    </div>
                    <p className="font-semibold text-emerald-900">Project-Based Learning (Rotasi Siklus)</p>
                    <p className="text-[11px] text-slate-600">
                      Bahasa Indonesia, IPA, IPS, dan TIK bergantian per siklus 5 pekan.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 text-[11px] text-slate-500 border border-slate-200">
                    <strong>12.30 – 14.00 WITA:</strong> Shalat Zhuhur Berjamaah &amp; Makan Siang
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-800">14.00 – 15.30 WITA</span>
                      <Badge variant="green" size="sm">PBL Sesi 2</Badge>
                    </div>
                    <p className="font-semibold text-emerald-900">Presentasi Karya &amp; Portofolio Proyek</p>
                    <p className="text-[11px] text-slate-600">
                      Evaluasi produk proyek, penulisan laporan ilmiah, dan asesmen guru.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Ahad: Hari Mandiri */}
              <Card rounded="3xl" className="border border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-amber-900">Ahad: Hari Mandiri &amp; Wali</CardTitle>
                    <Badge variant="gold" size="sm">Istirahat &amp; Olahraga</Badge>
                  </div>
                  <CardDescription>Kegiatan penyegaran dan kunjungan orang tua santri</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>08.00 – 11.00: Olahraga Sunnah (Memanah, Berenang, Beladiri)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>11.00 – 17.00: Waktu Kunjungan Resmi Wali Santri</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>17.00: Santri wajib kembali ke asrama &amp; persiapan Maghrib</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: KALENDER KEGIATAN */}
      {subTab === "kalender" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-700">Kategori:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "ALL", label: "Semua" },
                  { id: "TAHFIZH", label: "Tahfizh" },
                  { id: "UJIAN", label: "Ujian" },
                  { id: "KEGIATAN_SANTRI", label: "Kegiatan" },
                  { id: "LIBUR", label: "Libur" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFilterKategori(cat.id)}
                    className={cn(
                      "px-3 py-1 rounded-xl text-xs font-semibold transition-all min-h-[32px]",
                      filterKategori === cat.id
                        ? "bg-[#0E7C3A] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs text-slate-400">
              Menampilkan {filteredAgendas.length} agenda
            </span>
          </div>

          {/* Agenda Grid */}
          {filteredAgendas.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
              <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Tidak ada agenda ditemukan</p>
              <p className="text-xs text-slate-400 mt-1">
                {filterKategori !== "ALL"
                  ? "Coba ubah filter kategori di atas."
                  : "Belum ada agenda yang dijadwalkan."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAgendas.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-200 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Badge
                      variant={
                        item.kategori === "TAHFIZH"
                          ? "green"
                          : item.kategori === "LIBUR"
                          ? "gold"
                          : "sky"
                      }
                      size="sm"
                    >
                      {item.kategori.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {item.tanggal}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{item.judul}</h4>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                      {item.lokasi}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DIALOG: TAMBAH AGENDA */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#0E7C3A]" />
                <h3 className="font-bold text-slate-800 text-base">Tambah Agenda Kalender</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Judul Kegiatan *</label>
                <Input
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="e.g. Ujian Tahfizh Semester Ganjil"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Tanggal Kegiatan *</label>
                <Input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Kategori Kegiatan</label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-[#0E7C3A]/20"
                >
                  <option value="TAHFIZH">Ketahfidzan / Ikhtibar</option>
                  <option value="UJIAN">Ujian Akademik &amp; Diniyah</option>
                  <option value="KEGIATAN_SANTRI">Kegiatan Santri / Rihlah</option>
                  <option value="LIBUR">Libur &amp; Kepulangan Santri</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Lokasi Pelaksanaan</label>
                <Input
                  value={lokasi}
                  onChange={(e) => setLokasi(e.target.value)}
                  placeholder="e.g. Kompleks Pondok STQ DUC"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isPending}
                  leftIcon={<PlusCircle className="h-4 w-4" />}
                >
                  Simpan Agenda
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
