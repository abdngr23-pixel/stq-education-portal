import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "highlight" | "glass";
  rounded?: "2xl" | "3xl";
  hoverable?: boolean;
}

export function Card({
  className,
  variant = "default",
  rounded = "3xl",
  hoverable = false,
  children,
  ...props
}: CardProps) {
  const roundedClass = rounded === "3xl" ? "rounded-3xl" : "rounded-2xl";

  const variantStyles = {
    default: "bg-white border border-slate-200/80 shadow-xs",
    highlight: "bg-white border-2 border-[#0E7C3A]/30 shadow-xs",
    glass: "bg-white/90 backdrop-blur-md border border-white/60 shadow-xs",
  };

  return (
    <div
      className={cn(
        roundedClass,
        variantStyles[variant],
        "p-5 md:p-6 transition-all duration-200",
        hoverable ? "hover:border-[#0E7C3A]/40 hover:shadow-md cursor-pointer" : "",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-1.5 pb-4 border-b border-slate-100", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-bold text-slate-800 tracking-tight", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs md:text-sm text-slate-500", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pt-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pt-4 border-t border-slate-100 flex items-center", className)} {...props}>
      {children}
    </div>
  );
}
