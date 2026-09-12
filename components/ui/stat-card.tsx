import React from "react";
import { Card } from "./card";
import { Badge, BadgeVariant } from "./badge";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  badgeText?: string;
  badgeVariant?: BadgeVariant;
  icon?: React.ReactNode;
  accentBorder?: boolean;
  isAppreciation?: boolean; // Khusus metrik apresiasi (Bintang Kebaikan/Mutqin)
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  badgeText,
  badgeVariant = "green",
  icon,
  accentBorder = false,
  isAppreciation = false,
  className,
}: StatCardProps) {
  return (
    <Card
      rounded="2xl"
      className={cn(
        "p-4 sm:p-5 relative overflow-hidden transition-all duration-200 hover:shadow-xs min-w-0",
        accentBorder ? "border-l-4 border-l-[#0E7C3A]" : "",
        isAppreciation ? "border-amber-200/90 bg-gradient-to-br from-white to-amber-50/30" : "",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="space-y-1 min-w-0 flex-1">
          {/* Label: 11-13px abu-abu di atas (Bungkus rapi, cegah pemotongan elipsis pada layar ponsel) */}
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider line-clamp-2 break-words leading-tight">
            {title}
          </p>
          {/* Angka ringkasan: 18-24px di bawah */}
          <div className="text-lg sm:text-2xl font-bold text-slate-800 tracking-tight font-heading truncate">
            {value}
          </div>
          {description && (
            <p className="text-[11px] sm:text-xs text-slate-500 leading-snug line-clamp-2 break-words">
              {description}
            </p>
          )}
        </div>

        {icon && (
          <div
            className={cn(
              "h-10 w-10 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform",
              isAppreciation
                ? "bg-amber-100/80 text-[#A87E0B]"
                : "bg-emerald-50 text-[#0E7C3A]"
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {badgeText && (
        <div className="mt-3 pt-2.5 border-t border-slate-100/90 flex items-center justify-between">
          <Badge variant={badgeVariant} size="sm">
            {badgeText}
          </Badge>
        </div>
      )}
    </Card>
  );
}
