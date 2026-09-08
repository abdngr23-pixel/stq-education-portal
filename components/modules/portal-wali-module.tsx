"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Role } from "@/types/auth";
import {
  Printer,
  MessageCircle,
  Send,
} from "lucide-react";

export interface SaranItem {
  id: string;
  nama: string;
  kategori: string;
  pesan: string;
  tanggapan: string | null;
  status: string;
}

export interface PortalWaliModuleProps {
  userRole: Role;
  kotakSaranList: SaranItem[];
  onKirimSaran: (kategori: string, pesan: string) => Promise<void> | void;
  onPrintRapor: () => void;
  isPending?: boolean;
}

export function PortalWaliModule({
  userRole,
  kotakSaranList,
  onKirimSaran,
  onPrintRapor,
  isPending = false,
}: PortalWaliModuleProps) {
  const [kategori, setKategori] = useState("Gizi & Katering");
  const [pesan, setPesan] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pesan.trim()) {
      setErrorMsg("Pesan atau saran tidak boleh kosong.");
      return;
    }
    setErrorMsg("");
    await onKirimSaran(kategori, pesan.trim());
    setPesan("");
  };

  return (
    <div className="space-y-6">
      {/* Header Hero Wali Santri */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-[#0E7C3A] text-white rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <Badge variant="gold" size="sm" className="mb-2">Portal Orang Tua & Santri</Badge>
          <h3 className="text-xl font-bold font-heading">
            {userRole === "WS" ? "Ahlan wa Sahlan, Ayah/Bunda Wali Santri" : "Ahlan wa Sahlan, Santri Mandiri STQ DUC"}
          </h3>
          <p className="text-xs text-emerald-100 mt-1">
            Pantau perkembangan hafalan Al-Qur&apos;an, adab & kedisiplinan, kesehatan, serta capaian prestasi ananda.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrintRapor}
          leftIcon={<Printer className="h-4 w-4" />}
        >
          Unduh / Cetak Rapor Digital
        </Button>
      </div>

      {/* Kartu Profil Ananda */}
      <Card rounded="3xl" className="border-2 border-emerald-100 bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-lg font-bold text-slate-900">Obama Ozearld Egberted Turizqi</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                NIS: <strong>SAN-0001</strong> • Kelas: <strong>9A Takhossus</strong> • Musyrif: <strong>Ust. Razan Mufli, S.Pd</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="green" size="md">Santri Aktif</Badge>
              <Badge variant="gold" size="md">2 Bintang Teladan</Badge>
            </div>
          </div>

          {/* 4 Metrik Ringkas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <span className="text-xs text-emerald-800 font-semibold">Capaian Tahfizh</span>
              <p className="text-xl font-extrabold text-[#0E7C3A] mt-1">22 Juz</p>
              <span className="text-[11px] text-emerald-600 font-medium">Ikhtibar Juz 22 Lulus</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
              <span className="text-xs text-amber-800 font-semibold">Rapor Akademik</span>
              <p className="text-xl font-extrabold text-[#C9990E] mt-1">89.0 / A</p>
              <span className="text-[11px] text-amber-700 font-medium">Peringkat 3 Kelas</span>
            </div>

            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100">
              <span className="text-xs text-sky-800 font-semibold">Poin Kedisiplinan</span>
              <p className="text-xl font-extrabold text-sky-700 mt-1">0 Poin</p>
              <span className="text-[11px] text-sky-600 font-medium">Bersih / Teladan</span>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
              <span className="text-xs text-purple-800 font-semibold">Status Kesehatan</span>
              <p className="text-xl font-extrabold text-purple-700 mt-1">Sehat</p>
              <span className="text-[11px] text-purple-600 font-medium">Poskestren Terpantau</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2 Kolom: Aktivitas & Kotak Saran */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kolom Kiri: Riwayat Aktivitas Terkini */}
        <div className="space-y-4">
          <Card rounded="3xl">
            <CardHeader>
              <CardTitle className="text-base">Riwayat Setoran & Ikhtibar Terbaru</CardTitle>
              <CardDescription>Catatan langsung dari majelis halaqoh</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 text-xs">Setoran Sabaq (Hafalan Baru)</span>
                  <p className="text-xs text-emerald-700 font-semibold">Ali &apos;Imran: 1-20 (Juz 4)</p>
                  <p className="text-[11px] text-slate-400">Catatan: Makhraj dan tajwid fasih</p>
                </div>
                <Badge variant="green" size="sm">MUMTAZ</Badge>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 text-xs">Ujian Ikhtibar Juz 4 (Tahap 1)</span>
                  <p className="text-xs text-amber-700 font-semibold">Penguji: Ust. Razan Mufli, S.Pd (MT)</p>
                  <p className="text-[11px] text-slate-400">Nilai: 92/100 • Siap Ujian Mudir</p>
                </div>
                <Badge variant="gold" size="sm">LULUS TAHAP 1</Badge>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 text-xs">Pengajuan Izin Pulang Terakhir</span>
                  <p className="text-xs text-slate-600">Keperluan: Menghadiri pernikahan keluarga</p>
                  <p className="text-[11px] text-emerald-600">Telah Disetujui Mudir & MK</p>
                </div>
                <Badge variant="green" size="sm">DISETUJUI</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Kotak Saran Wali Santri */}
        <div className="space-y-4">
          <Card rounded="3xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#0E7C3A]" />
                <CardTitle className="text-base">Kotak Saran & Aspirasi Wali Santri</CardTitle>
              </div>
              <CardDescription>
                Kirimkan masukan atau pertanyaan langsung kepada Mudir & Pengurus Pesantren
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Kategori Aspirasi</label>
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#0E7C3A]/20"
                  >
                    <option value="Gizi & Katering">Gizi, Makanan & Katering Asrama</option>
                    <option value="Tahfizh & Musyrif">Ketahfidzan & Majelis Halaqoh</option>
                    <option value="Kedisiplinan & Asrama">Kedisiplinan & Kebersihan Kamar</option>
                    <option value="Fasilitas & Sarpras">Fasilitas, Ranjang & UKS</option>
                    <option value="Administrasi & SPP">Administrasi, SPP & Beasiswa</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Pesan / Masukan Anda</label>
                  <textarea
                    rows={3}
                    value={pesan}
                    onChange={(e) => setPesan(e.target.value)}
                    placeholder="Tuliskan masukan atau saran konstruktif Bapak/Ibu demi kemajuan ananda dan pesantren..."
                    className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-[#0E7C3A] focus:outline-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isPending}
                  leftIcon={<Send className="h-4 w-4" />}
                  size="sm"
                >
                  Kirim Saran ke Mudir
                </Button>
              </form>

              {/* Riwayat Aspirasi & Tanggapan */}
              <div className="pt-2 space-y-3">
                <h5 className="text-xs font-bold text-slate-700">Aspirasi Anda Sebelumnya:</h5>
                {kotakSaranList.map((s) => (
                  <div key={s.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{s.kategori}</span>
                      <Badge variant={s.status === "DITANGGAPI" ? "green" : "gold"} size="sm">
                        {s.status}
                      </Badge>
                    </div>
                    <p className="text-slate-600 italic">&quot;{s.pesan}&quot;</p>
                    {s.tanggapan && (
                      <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100 text-emerald-900 mt-2">
                        <p className="font-bold text-[11px]">Tanggapan Pimpinan Pondok:</p>
                        <p className="mt-0.5">{s.tanggapan}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
