import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "green" | "gold" | "sky" | "orange" | "purple" | "neutral";
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
  const variantStyles = {
    green: "bg-emerald-50 text-[#0E7C3A] border-emerald-200/80",
    gold: "bg-amber-50 text-[#A87E0B] border-amber-200/80",
    sky: "bg-sky-50 text-sky-700 border-sky-200/80",
    orange: "bg-orange-50 text-orange-700 border-orange-200/80",
    purple: "bg-purple-50 text-purple-700 border-purple-200/80",
    neutral: "bg-slate-100 text-slate-700 border-slate-200/80",
  };

  const dotColor = {
    green: "bg-[#0E7C3A]",
    gold: "bg-[#C9990E]",
    sky: "bg-sky-500",
    orange: "bg-orange-500",
    purple: "bg-purple-600",
    neutral: "bg-slate-400",
  };

  const sizeStyles = {
    sm: "px-2.5 py-0.5 text-xs rounded-lg gap-1",
    md: "px-3 py-1 text-xs font-medium rounded-xl gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center border font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[variant])} />}
      {children}
    </span>
  );
}
