"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { formatIndonesianPhone, generateWALink } from "@/lib/whatsapp";
import { Copy, Check, Send, Phone, MessageSquare, X } from "lucide-react";

export interface WhatsAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPhone?: string;
  defaultRecipientName?: string;
  defaultMessage: string;
  title?: string;
  description?: string;
}

export function WhatsAppDialog({
  isOpen,
  onClose,
  defaultPhone = "081299887766",
  defaultRecipientName = "Wali Santri",
  defaultMessage,
  title = "Kirim Pesan via WhatsApp Direct",
  description = "Pesan akan otomatis terkirim dari aplikasi WhatsApp resmi Anda tanpa biaya langganan API.",
}: WhatsAppDialogProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [recipientName, setRecipientName] = useState(defaultRecipientName);
  const [message, setMessage] = useState(defaultMessage);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPhone(defaultPhone || "081299887766");
    setRecipientName(defaultRecipientName || "Wali Santri");
    setMessage(defaultMessage || "");
    setCopied(false);
  }, [defaultPhone, defaultRecipientName, defaultMessage, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenWhatsApp = () => {
    const link = generateWALink(phone, message);
    if (typeof window !== "undefined") {
      window.open(link, "_blank", "noopener,noreferrer");
    }
    onClose();
  };

  const formattedDestination = formatIndonesianPhone(phone);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <Card
        rounded="3xl"
        className="max-w-xl w-full p-6 bg-white border border-slate-200/90 shadow-2xl space-y-5 my-8 relative"
      >
        {/* Tombol Tutup Silang */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Tutup Modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Modal */}
        <div className="flex items-start gap-3 border-b border-slate-100 pb-4 pr-8">
          <div className="h-10 w-10 rounded-2xl bg-[#25D366]/15 text-[#128C7E] flex items-center justify-center border border-[#25D366]/30 shadow-2xs shrink-0">
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 font-heading">
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {description}
            </p>
          </div>
        </div>

        {/* Form Isi & Pratinjau */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Nama Penerima / Wali
              </label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="misal: Bapak Ridwan (Wali Obama)"
                className="text-xs bg-slate-50 border-slate-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between mb-1.5">
                <span>Nomor WhatsApp (+62 / 08)</span>
                <span className="text-[10px] text-emerald-700 font-mono font-semibold">
                  WA: +{formattedDestination}
                </span>
              </label>
              <div className="relative">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812-xxxx-xxxx"
                  className="text-xs bg-slate-50 border-slate-200 pl-8 font-mono"
                />
                <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                Pratinjau Teks Pesan Terformat
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-semibold text-slate-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span className="text-emerald-600">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Salin Teks</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-2xl bg-slate-50/90 border border-slate-200 p-3.5 text-xs text-slate-800 font-mono leading-relaxed focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all resize-y"
            />
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-900 flex items-start gap-2">
            <span className="text-emerald-700 font-bold shrink-0">💡 Info:</span>
            <p>
              Klik tombol <strong>Buka WhatsApp</strong> untuk langsung meluncurkan aplikasi WhatsApp di HP atau WhatsApp Web di laptop dengan nomor tujuan dan teks laporan yang telah terisi rapi.
            </p>
          </div>
        </div>

        {/* Footer Aksi */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-full sm:w-auto text-slate-600"
          >
            Batal
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              leftIcon={copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              {copied ? "Tersalin!" : "Salin Teks"}
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleOpenWhatsApp}
              className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white border-0 shadow-md hover:shadow-lg font-bold"
              leftIcon={<Send className="h-4 w-4" />}
            >
              Buka WhatsApp
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
