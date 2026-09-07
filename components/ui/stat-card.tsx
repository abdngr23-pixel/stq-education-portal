import React from "react";
import { Card } from "./card";
import { Badge } from "./badge";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  badgeText?: string;
  badgeVariant?: "green" | "gold" | "sky" | "orange" | "purple" | "neutral";
  icon?: React.ReactNode;
  accentBorder?: boolean;
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
  className,
}: StatCardProps) {
  return (
    <Card
      rounded="2xl"
      className={cn(
        "p-5 relative overflow-hidden transition-all duration-200 hover:shadow-sm",
        accentBorder ? "border-l-4 border-l-[#0E7C3A]" : "",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <div className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight font-heading">
            {value}
          </div>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        {icon && (
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-[#0E7C3A] flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>

      {badgeText && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center">
          <Badge variant={badgeVariant} size="sm">
            {badgeText}
          </Badge>
        </div>
      )}
    </Card>
  );
}
