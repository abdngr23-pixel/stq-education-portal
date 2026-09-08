import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "green"
  | "gold"
  | "sky"
  | "orange"
  | "purple"
  | "neutral"
  // Status Tahfizh
  | "mumtaz"
  | "jayyid_jiddan"
  | "jayyid"
  | "maqbul"
  | "dhoif"
  // Status Perizinan & Disiplin
  | "disetujui"
  | "menunggu"
  | "ditolak"
  | "aman"
  | "sp1"
  | "sp2"
  | "sp3";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "green",
  size = "md",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    gold: "bg-amber-100 text-amber-900 border-amber-300/80 shadow-xs", // Khusus pencapaian / apresiasi
    sky: "bg-sky-50 text-sky-800 border-sky-200",
    orange: "bg-orange-50 text-orange-800 border-orange-200",
    purple: "bg-purple-50 text-purple-800 border-purple-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",

    // Tahfizh Grading
    mumtaz: "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold",
    jayyid_jiddan: "bg-sky-50 text-sky-800 border-sky-200 font-semibold",
    jayyid: "bg-teal-50 text-teal-800 border-teal-200 font-semibold",
    maqbul: "bg-amber-50 text-amber-800 border-amber-200 font-semibold",
    dhoif: "bg-rose-50 text-rose-800 border-rose-200 font-semibold",

    // Status Perizinan
    disetujui: "bg-emerald-50 text-emerald-800 border-emerald-200 font-medium",
    menunggu: "bg-amber-50 text-amber-800 border-amber-200 font-medium",
    ditolak: "bg-rose-50 text-rose-800 border-rose-200 font-medium",

    // Status Disiplin (Tenang & Edukatif)
    aman: "bg-emerald-50 text-emerald-800 border-emerald-200 font-medium",
    sp1: "bg-amber-50 text-amber-900 border-amber-300 font-semibold",
    sp2: "bg-orange-50 text-orange-900 border-orange-300 font-semibold",
    sp3: "bg-rose-50 text-rose-900 border-rose-300 font-bold",
  };

  const dotColor: Record<BadgeVariant, string> = {
    green: "bg-emerald-600",
    gold: "bg-[#C9990E]",
    sky: "bg-sky-600",
    orange: "bg-orange-600",
    purple: "bg-purple-600",
    neutral: "bg-slate-400",

    mumtaz: "bg-emerald-600",
    jayyid_jiddan: "bg-sky-600",
    jayyid: "bg-teal-600",
    maqbul: "bg-amber-600",
    dhoif: "bg-rose-600",

    disetujui: "bg-emerald-600",
    menunggu: "bg-amber-600",
    ditolak: "bg-rose-600",

    aman: "bg-emerald-600",
    sp1: "bg-amber-600",
    sp2: "bg-orange-600",
    sp3: "bg-rose-700",
  };

  const sizeStyles = {
    sm: "px-2.5 py-0.5 text-xs rounded-lg gap-1",
    md: "px-3 py-1 text-xs font-medium rounded-xl gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center border",
        variantStyles[variant] || variantStyles.green,
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor[variant] || dotColor.green)} />}
      {children}
    </span>
  );
}
