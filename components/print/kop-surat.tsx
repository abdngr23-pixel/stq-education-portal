import React from "react";
import { INSTITUTION_CONFIG } from "@/lib/institution-config";

export function KopSurat() {
  return (
    <div className="pb-4 mb-4 border-b-4 border-double border-black text-black">
      <div className="flex items-center gap-4">
        {/* Logo Monokrom/Formal */}
        <div className="h-20 w-20 shrink-0 flex items-center justify-center p-1 border border-black/30 rounded-lg">
          <img
            src="/logo.png"
            alt="Logo STQ"
            className="h-full w-full object-contain filter grayscale"
          />
        </div>

        {/* Teks Identitas Lembaga */}
        <div className="flex-1 text-center leading-tight space-y-0.5">
          <p className="text-xs uppercase tracking-widest font-semibold">
            {INSTITUTION_CONFIG.yayasanName}
          </p>
          <h2 className="text-base sm:text-lg font-bold uppercase tracking-tight font-serif">
            {INSTITUTION_CONFIG.pesantrenName}
          </h2>
          {(INSTITUTION_CONFIG.nsp || INSTITUTION_CONFIG.skKemenag) && (
            <p className="text-[10px] text-gray-700">
              {INSTITUTION_CONFIG.nsp} {INSTITUTION_CONFIG.skKemenag ? `• ${INSTITUTION_CONFIG.skKemenag}` : ""}
            </p>
          )}
          <p className="text-[10px] text-gray-600">
            {INSTITUTION_CONFIG.alamat}
            {INSTITUTION_CONFIG.telepon ? ` | Telp: ${INSTITUTION_CONFIG.telepon}` : ""}
            {INSTITUTION_CONFIG.email ? ` | Email: ${INSTITUTION_CONFIG.email}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
