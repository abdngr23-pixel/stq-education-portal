"use client";

import React, { useState, useTransition } from "react";
import { Role } from "@/types/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { generateLaporanSponsorAction, kirimLaporanWhatsAppAction } from "@/app/actions/sponsor";
import { WhatsAppDialog } from "@/components/ui/whatsapp-dialog";
import {
  HeartHandshake,
  Search,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

export interface SponsorItem {
  id: string;
  kode: string;
  nama: string;
  noHp: string;
  santriAsuh: string;
  santriId?: string;
  nominal: number;
  statusWA: "BELUM_KIRIM" | "TERKIRIM";
  terakhirKirim: string;
}

export interface SponsorModuleProps {
  userRole: Role;
  currentUserName: string;
}

export function SponsorModule({ userRole, currentUserName }: SponsorModuleProps) {
  const [list, setList] = useState<SponsorItem[]>([
    {
      id: "spn_1",
      kode: "OTA-001",
      nama: "H. Bambang Irawan & Keluarga",
      noHp: "081298765432",
      santriAsuh: "Obama Ozearld Egberted Turizqi (SAN-0001)",
      santriId: "cm_santri_1",
      nominal: 1500000,
      statusWA: "TERKIRIM",
      terakhirKirim: "07/09/2026",
    },
    {
      id: "spn_2",
      kode: "OTA-002",
      nama: "Ibu Hj. Rina Marlina",
      noHp: "081388776655",
      santriAsuh: "Muhammad Fardhan (SAN-0002)",
      santriId: "cm_santri_2",
      nominal: 2000000,
      statusWA: "BELUM_KIRIM",
      terakhirKirim: "-",
    },
  ]);

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // WhatsApp Dialog State
  const [waDialog, setWaDialog] = useState<{
    isOpen: boolean;
    phone: string;
    recipientName: string;
    message: string;
    title: string;
    description: string;
    laporanId?: string;
  }>({
    isOpen: false,
    phone: "",
    recipientName: "Donatur Orang Tua Asuh",
    message: "",
    title: "Kirim Laporan Perkembangan Santri Asuh",
    description: "Laporan kemajuan hafalan dan akhlak santri akan dibuka di WhatsApp resmi Anda.",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const filteredList = list.filter(
    (item) =>
      item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.santriAsuh.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleKirimLaporanWA = (sponsor: SponsorItem) => {
    setFeedback(null);
    startTransition(async () => {
      // 1. Generate Laporan Terverifikasi
      const res = await generateLaporanSponsorAction({
        sponsorId: sponsor.id,
        santriId: sponsor.santriId || "cm_santri_1",
        bulan: "September 2026",
        catatanMusyrif: "Ananda menunjukkan ketekunan istimewa dalam halaqoh Al-Qur'an dan kedisiplinan asrama.",
      });

      if (res.success && res.data) {
        const laporan = res.data;
        const msg = `*LAPORAN PERKEMBANGAN SANTRI ASUH BEASISWA*\n*STQ DARUL ULUM CENDEKIA*\n_Yayasan Infak Medika Nusantara_\n\nKepada Yth. *${sponsor.nama}*\n\nBerikut kami sampaikan ringkasan mutaba'ah ananda *${sponsor.santriAsuh}*:\n• *Periode Laporan:* September 2026\n• *Status Laporan:* Terverifikasi Resmi\n• *Kode Laporan:* ${laporan.kodeLaporan}\n• *Catatan Pembina:* Ananda istiqomah dalam halaqoh Al-Qur'an dan adab asrama.\n\nJazakumullahu khairan katsiran atas infak beasiswa dan doa bapak/ibu sekalian. Semoga menjadi amal jariyah yang terus mengalir pahalanya. Aamiin.\n\n_Wassalamu'alaikum Warahmatullahi Wabarakatuh_\n*Pengurus STQ Darul Ulum Cendekia (${currentUserName})*`;

        setWaDialog({
          isOpen: true,
          phone: sponsor.noHp,
          recipientName: sponsor.nama,
          message: msg,
          title: `Laporan Santri Asuh untuk ${sponsor.nama}`,
          description: "Periksa kembali pesan sebelum mengirim via WhatsApp Direct.",
          laporanId: laporan.id,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Gagal menyusun laporan perkembangan santri.",
        });
      }
    });
  };

  const handleConfirmSent = (laporanId?: string, sponsorId?: string) => {
    if (!laporanId) return;
    startTransition(async () => {
      const res = await kirimLaporanWhatsAppAction(laporanId);
      if (res.success) {
        setList((prev) =>
          prev.map((s) =>
            s.id === sponsorId || s.noHp === waDialog.phone
              ? { ...s, statusWA: "TERKIRIM", terakhirKirim: new Date().toLocaleDateString("id-ID") }
              : s
          )
        );
        setFeedback({
          type: "success",
          message: `Laporan untuk ${waDialog.recipientName} telah ditandai berhasil terkirim.`,
        });
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Header Operasional */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-purple-600" />
            Program Orang Tua Asuh &amp; Beasiswa Tahfizh
          </h2>
          <p className="text-xs text-slate-500">
            Penyaluran beasiswa santri yatim/dhuafa dan laporan perkembangan hafalan berkala kepada donatur
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

      {/* Toolbar Pencarian */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari donatur atau santri asuh..."
          className="pl-9 min-h-[42px] text-xs sm:text-sm"
        />
      </div>

      {/* Daftar Donatur & Santri Asuh */}
      <Card rounded="3xl" className="border border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {filteredList.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {item.kode}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{item.nama}</h4>
                      <Badge variant="purple" size="sm">
                        Rp {item.nominal.toLocaleString("id-ID")}/bln
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700">
                      <strong>Santri Asuh:</strong> {item.santriAsuh}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Kontak WA: {item.noHp} • Laporan Terakhir: {item.terakhirKirim}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <Badge
                      variant={item.statusWA === "TERKIRIM" ? "green" : "orange"}
                      size="sm"
                      className="font-bold"
                    >
                      {item.statusWA === "TERKIRIM" ? "Laporan Terkirim" : "Belum Dikirim"}
                    </Badge>

                    {["ADM", "KS", "YAY"].includes(userRole) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleKirimLaporanWA(item)}
                        disabled={isPending}
                        className="text-xs font-bold gap-1.5 min-h-[38px] text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-[#0E7C3A]" />
                        Kirim Laporan WA
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              Tidak ada data donatur orang tua asuh yang cocok.
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Dialog dengan Konfirmasi Manual Jujur (Point 5 & 10) */}
      <WhatsAppDialog
        isOpen={waDialog.isOpen}
        defaultPhone={waDialog.phone}
        defaultRecipientName={waDialog.recipientName}
        defaultMessage={waDialog.message}
        title={waDialog.title}
        description={waDialog.description}
        onClose={() => setWaDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirmSent={() => handleConfirmSent(waDialog.laporanId)}
      />
    </div>
  );
}
