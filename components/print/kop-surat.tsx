import React from "react";

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
            Yayasan Darul Ulum Cendekia
          </p>
          <h2 className="text-base sm:text-lg font-bold uppercase tracking-tight font-serif">
            Pondok Pesantren Tahfizh Qur&apos;an Darul Ulum Cendekia
          </h2>
          <p className="text-[10px] text-gray-700">
            Nomor Statistik Pesantren (NSP): 510032010123 • SK Kemenag RI No. 492/2021
          </p>
          <p className="text-[10px] text-gray-600">
            Jl. Cendekia No. 12, Kompleks Pesantren STQ DUC | Telp: (021) 88997766 | Email: info@stqduc.sch.id
          </p>
        </div>
      </div>
    </div>
  );
}
