import React from "react";
import { cn } from "@/lib/utils";

export interface KopSuratProps {
  className?: string;
  showDivider?: boolean;
}

/**
 * Kop Surat Resmi Lembaga
 * STQ Darul Ulum Cendekia & Yayasan Infak Medika Nusantara - Alumni FKUH
 *
 * Sesuai format baku dokumen resmi / surat dinas:
 * - Sisi Kiri : Logo Yayasan Infak Medika Nusantara (YIMN Alumni FKUH)
 * - Sisi Tengah: Teks Identitas Resmi Lembaga & Alamat Sekretariat
 * - Sisi Kanan: Logo STQ Darul Ulum Cendekia
 * - Garis Pembatas: Garis ganda formal (tebal-tipis) khas surat kedinasan/pesantren
 */
export function KopSurat({ className, showDivider = true }: KopSuratProps) {
  return (
    <header className={cn("text-black pb-2 mb-4 select-none", className)}>
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        {/* 1. Logo Kiri: Yayasan Infak Medika Nusantara - Alumni FKUH */}
        <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 flex items-center justify-center">
          <img
            src="/logo-yayasan.png"
            alt="Logo Yayasan Infak Medika Nusantara - Alumni FKUH"
            width={80}
            height={80}
            className="h-full w-full object-contain"
          />
        </div>

        {/* 2. Teks Tengah: Identitas Lembaga & Alamat Sekretariat Resmi */}
        <div className="flex-1 text-center leading-tight">
          <h1 className="text-sm sm:text-base md:text-lg font-bold uppercase tracking-normal font-sans text-black">
            SEKOLAH TAHFIZHUL QUR&apos;AN
          </h1>
          <h2 className="text-base sm:text-lg md:text-xl font-black uppercase tracking-tight font-sans text-black mt-0.5">
            DARUL ULUM CENDEKIA
          </h2>
          <p className="text-[11px] sm:text-xs md:text-sm font-bold uppercase tracking-wide text-black mt-0.5 sm:mt-1">
            YAYASAN INFAK MEDIKA NUSANTARA - ALUMNI FKUH
          </p>
          <p className="text-[8.5px] sm:text-[9.5px] md:text-[10px] text-gray-800 font-sans mt-1 sm:mt-1.5 leading-snug">
            Sekretariat : Jl. Tamangapa Raya 5, RT.003/RW.003, Tamangapa, Kec. Manggala, Kota Makassar, Sulawesi Selatan 90235 (No.HP : 085245160499)
          </p>
        </div>

        {/* 3. Logo Kanan: STQ Darul Ulum Cendekia */}
        <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Logo STQ Darul Ulum Cendekia"
            width={80}
            height={80}
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      {/* 4. Garis Pembatas Formal Khas Kop Surat (Double Line: Tebal + Tipis) */}
      {showDivider && (
        <div className="mt-2 sm:mt-3 w-full space-y-[2px]" aria-hidden="true">
          <div className="border-b-[2.5px] border-black" />
          <div className="border-b-[0.75px] border-black" />
        </div>
      )}
    </header>
  );
}
