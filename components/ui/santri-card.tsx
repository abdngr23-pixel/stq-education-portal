import React from "react";
import { Badge, BadgeVariant } from "./badge";
import { Card } from "./card";
import { cn } from "@/lib/utils";
import { BookOpen, Star, AlertTriangle, ShieldCheck } from "lucide-react";

export interface SantriCardProps {
  nama: string;
  nis: string;
  kelas: string;
  halaqoh?: string;
  pembina?: string;
  capaianJuz?: number;
  targetJuz?: number;
  setoranTerakhir?: string;
  nilaiTerakhir?: string;
  poinPelanggaran?: number;
  bintangKebaikan?: number;
  status?: string;
  actionButton?: React.ReactNode;
  onShareWA?: () => void;
  onClick?: () => void;
  className?: string;
  highlight?: boolean;
}

export function SantriCard({
  nama,
  nis,
  kelas,
  halaqoh,
  capaianJuz,
  targetJuz,
  setoranTerakhir,
  nilaiTerakhir,
  poinPelanggaran,
  bintangKebaikan,
  status = "AKTIF",
  actionButton,
  onShareWA,
  onClick,
  className,
  highlight = false,
}: SantriCardProps) {
  // Inisial avatar
  const initials = nama
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  // Mapping badge nilai tahfizh
  const getNilaiBadge = (n?: string): { variant: BadgeVariant; label: string } => {
    switch (n?.toUpperCase()) {
      case "MUMTAZ":
        return { variant: "mumtaz", label: "Mumtaz" };
      case "JAYYID_JIDDAN":
        return { variant: "jayyid_jiddan", label: "Jayyid Jiddan" };
      case "JAYYID":
        return { variant: "jayyid", label: "Jayyid" };
      case "MAQBUL":
        return { variant: "maqbul", label: "Maqbul" };
      case "DHOIF":
      case "RASIB":
      case "REMEDIAL":
        return { variant: "dhoif", label: "Perlu Latihan" };
      default:
        return { variant: "neutral", label: n || "Belum Ada" };
    }
  };

  const nilaiBadge = getNilaiBadge(nilaiTerakhir);

  return (
    <Card
      rounded="2xl"
      onClick={onClick}
      className={cn(
        "p-4 sm:p-5 transition-all duration-200 hover:shadow-xs min-w-0 bg-white border border-slate-200/80",
        highlight ? "ring-2 ring-emerald-500/20 border-emerald-300" : "",
        onClick ? "cursor-pointer hover:border-slate-300" : "",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        {/* Avatar & Identitas Santri */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-11 w-11 rounded-2xl bg-emerald-100 text-[#0E7C3A] font-bold flex items-center justify-center text-sm shrink-0 border border-emerald-200/80 shadow-2xs font-heading">
            {initials}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm font-bold text-slate-800 tracking-tight font-heading truncate max-w-[200px] sm:max-w-none">
                {nama}
              </h4>
              {status === "AKTIF" ? (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" title="Aktif" />
              ) : (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300" title="Non-aktif" />
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="font-mono text-[11px] font-semibold text-slate-600">{nis}</span>
              <span>•</span>
              <span className="font-medium text-slate-600">Kelas {kelas}</span>
              {halaqoh && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline truncate max-w-[150px]">{halaqoh}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Badge Capaian / Target Akhir 30 Juz */}
        {capaianJuz !== undefined && (
          <div className="shrink-0 text-right">
            <Badge variant="green" size="sm" className="font-bold">
              {capaianJuz} dari Target Akhir {targetJuz ?? 30} Juz
            </Badge>
          </div>
        )}
      </div>

      {/* Detail Riwayat Terakhir & Metrik */}
      <div className="mt-3 pt-3 border-t border-slate-100/90 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {setoranTerakhir && (
          <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
            <BookOpen className="h-3.5 w-3.5 text-[#0E7C3A] shrink-0" />
            <span className="text-slate-400 text-[11px]">Setoran:</span>
            <span className="font-medium text-slate-800 truncate" title={setoranTerakhir}>
              {setoranTerakhir}
            </span>
            {nilaiTerakhir && (
              <Badge variant={nilaiBadge.variant} size="sm" className="ml-auto shrink-0 text-[10px]">
                {nilaiBadge.label}
              </Badge>
            )}
          </div>
        )}

        {/* Indikator Disiplin & Apresiasi */}
        <div className="flex items-center gap-2 sm:justify-end">
          {bintangKebaikan !== undefined && bintangKebaikan > 0 && (
            <div className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded-xl border border-amber-200 text-[11px] font-semibold" title="Bintang Kebaikan">
              <Star className="h-3 w-3 fill-[#C9990E] text-[#C9990E]" />
              <span>{bintangKebaikan} Bintang</span>
            </div>
          )}

          {poinPelanggaran !== undefined && (
            poinPelanggaran > 0 ? (
              <div className="flex items-center gap-1 text-rose-800 bg-rose-50 px-2 py-0.5 rounded-xl border border-rose-200 text-[11px] font-semibold" title="Poin Pelanggaran">
                <AlertTriangle className="h-3 w-3 text-rose-600" />
                <span>{poinPelanggaran} Poin</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-xl border border-emerald-200 text-[11px] font-medium" title="Disiplin Baik">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                <span>Disiplin Baik</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Action CTA Button jika disediakan */}
      {(actionButton || onShareWA) && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          {onShareWA ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShareWA();
              }}
              title="Kirim Laporan WA ke Orang Tua Santri"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/30 text-xs font-bold transition-all"
            >
              <svg className="h-3.5 w-3.5 fill-current text-[#25D366] shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              <span>Kirim WA</span>
            </button>
          ) : <div />}
          {actionButton}
        </div>
      )}
    </Card>
  );
}
