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

        {/* Badge Capaian / Target */}
        {capaianJuz !== undefined && (
          <div className="shrink-0 text-right">
            <Badge variant="green" size="sm" className="font-bold">
              {capaianJuz} / {targetJuz || 30} Juz
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
      {actionButton && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end">
          {actionButton}
        </div>
      )}
    </Card>
  );
}
