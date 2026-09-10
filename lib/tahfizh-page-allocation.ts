/**
 * Modul Murni Alokasi Halaman Tahfizh (Single Source of Truth)
 * 
 * Standar STQ Darul Ulum Cendekia:
 * - Standar Mushaf Madinah: 604 Halaman, 30 Juz.
 * - Kapasitas maksimal tiap halaman Mushaf adalah 1.0 halaman.
 * - Volume setoran hanya dalam kelipatan 0.5 (setengah) halaman: 0.5, 1, 1.5, 2, dst.
 * - Pengisian multi-halaman berurutan: halaman awal dialokasikan penuh (1.0),
 *   pecahan 0.5 ditempatkan pada halaman terakhir.
 * - Rentang halaman [halamanMulai, halamanSelesai] harus konsisten dengan jumlahHalaman:
 *   (halamanSelesai - halamanMulai + 1) === Math.ceil(jumlahHalaman).
 */

export interface SetoranLikeRecord {
  id?: string;
  jenis: string;
  status: string;
  halamanMulai: number;
  halamanSelesai: number;
  jumlahHalaman: number;
  tanggal?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  proposedAllocation?: Record<number, number>;
  currentOccupancy?: Record<number, number>;
  exceededPage?: number;
}

export interface SabaqPositionResult {
  posisiTerakhirHalaman: number;
  isHalamanTerakhirParsial: boolean;
  isKhatam30Juz: boolean;
  saranHalamanMulai: number | null;
  saranJumlahHalaman: number | null;
  saranHalamanSelesai: number | null;
}

/**
 * Mengubah setoran Sabaq menjadi peta alokasi per-halaman secara proporsional.
 *
 * Contoh:
 * - 422–422, volume 1   => { 422: 1.0 }
 * - 422–423, volume 2   => { 422: 1.0, 423: 1.0 }
 * - 422–424, volume 2.5 => { 422: 1.0, 423: 1.0, 424: 0.5 }
 * - 422–422, volume 0.5 => { 422: 0.5 }
 */
export function allocateSabaqPages(
  halamanMulai: number,
  halamanSelesai: number,
  jumlahHalaman: number
): Record<number, number> {
  if (
    !Number.isFinite(halamanMulai) ||
    !Number.isInteger(halamanMulai) ||
    halamanMulai < 1 ||
    halamanMulai > 604
  ) {
    throw new Error(`Halaman mulai tidak valid: ${halamanMulai}. Harus bilangan bulat antara 1 s/d 604.`);
  }

  if (
    !Number.isFinite(halamanSelesai) ||
    !Number.isInteger(halamanSelesai) ||
    halamanSelesai < 1 ||
    halamanSelesai > 604
  ) {
    throw new Error(`Halaman selesai tidak valid: ${halamanSelesai}. Harus bilangan bulat antara 1 s/d 604.`);
  }

  if (halamanSelesai < halamanMulai) {
    throw new Error(
      `Rentang halaman tidak valid: halaman selesai (${halamanSelesai}) lebih kecil dari halaman mulai (${halamanMulai}).`
    );
  }

  if (
    !Number.isFinite(jumlahHalaman) ||
    jumlahHalaman <= 0 ||
    Math.round(jumlahHalaman * 2) !== jumlahHalaman * 2
  ) {
    throw new Error(
      `Jumlah halaman tidak valid: ${jumlahHalaman}. Harus berupa kelipatan 0.5 dan lebih besar dari 0.`
    );
  }

  const spanCount = halamanSelesai - halamanMulai + 1;
  const expectedSpan = Math.ceil(jumlahHalaman);

  if (spanCount !== expectedSpan) {
    throw new Error(
      `Inkonsistensi rentang halaman dan jumlah volume: rentang ${halamanMulai}–${halamanSelesai} (${spanCount} halaman) tidak sesuai dengan jumlah ${jumlahHalaman} halaman (kapasitas yang diharapkan: ${expectedSpan} halaman).`
    );
  }

  const isFractional = jumlahHalaman % 1 !== 0;
  const allocation: Record<number, number> = {};

  for (let p = halamanMulai; p <= halamanSelesai; p++) {
    if (p === halamanSelesai && isFractional) {
      allocation[p] = 0.5;
    } else {
      allocation[p] = 1.0;
    }
  }

  return allocation;
}

/**
 * Menghitung tingkat keterisian (occupancy) setiap nomor halaman Mushaf
 * dari kumpulan riwayat setoran SABAQ yang sah (aktif dan pasca-baseline).
 */
export function buildHistoricalPageOccupancy(
  setoranList: SetoranLikeRecord[],
  baselineDate?: Date | string | null
): Record<number, number> {
  const occupancy: Record<number, number> = {};
  const parsedBaseline = baselineDate ? new Date(baselineDate).getTime() : 0;

  for (const record of setoranList) {
    if (record.status === "DIBATALKAN") continue;
    if (record.jenis !== "SABAQ") continue;

    if (parsedBaseline > 0 && record.tanggal) {
      const recordTime = new Date(record.tanggal).getTime();
      if (recordTime < parsedBaseline) continue;
    }

    try {
      const alloc = allocateSabaqPages(
        record.halamanMulai,
        record.halamanSelesai,
        record.jumlahHalaman
      );
      for (const [pageStr, vol] of Object.entries(alloc)) {
        const page = Number(pageStr);
        occupancy[page] = Number(((occupancy[page] || 0) + vol).toFixed(2));
      }
    } catch {
      // Untuk record lama yang format volumenya tidak terstruktur rapi,
      // alokasikan secara aman tanpa memutus eksekusi
      const start = Math.max(1, Math.min(604, record.halamanMulai || 1));
      const end = Math.max(start, Math.min(604, record.halamanSelesai || start));
      const totalVol = Math.max(0, record.jumlahHalaman || 1);
      const span = end - start + 1;
      const volPerPage = Number((totalVol / span).toFixed(2));
      for (let p = start; p <= end; p++) {
        occupancy[p] = Number(((occupancy[p] || 0) + volPerPage).toFixed(2));
      }
    }
  }

  return occupancy;
}

/**
 * Memvalidasi apakah usulan setoran SABAQ baru dapat diterima tanpa
 * membuat halaman manapun melebihi batas kapasitas 1.0 halaman penuh.
 */
export function validateProposedSabaqAllocation(
  existingSetoranList: SetoranLikeRecord[],
  proposedHalamanMulai: number,
  proposedHalamanSelesai: number,
  proposedJumlahHalaman: number,
  baselineDate?: Date | string | null
): ValidationResult {
  let proposedAllocation: Record<number, number>;

  try {
    proposedAllocation = allocateSabaqPages(
      proposedHalamanMulai,
      proposedHalamanSelesai,
      proposedJumlahHalaman
    );
  } catch (err) {
    return {
      valid: false,
      message: (err as Error).message || "Format halaman setoran tidak valid.",
    };
  }

  const currentOccupancy = buildHistoricalPageOccupancy(existingSetoranList, baselineDate);

  for (const [pageStr, proposedVol] of Object.entries(proposedAllocation)) {
    const page = Number(pageStr);
    const existingVol = currentOccupancy[page] || 0;
    const combined = Number((existingVol + proposedVol).toFixed(2));

    if (existingVol >= 0.999) {
      return {
        valid: false,
        message: `Halaman ${page} sudah lengkap disetorkan (1.0 halaman penuh). Silakan lanjutkan ke halaman berikutnya atau ajukan koreksi resmi.`,
        proposedAllocation,
        currentOccupancy,
        exceededPage: page,
      };
    }

    if (combined > 1.001) {
      return {
        valid: false,
        message: `Akumulasi setoran pada halaman ${page} melebihi kapasitas 1 halaman (saat ini sudah tersimpan ${existingVol} halaman, diajukan ${proposedVol} halaman).`,
        proposedAllocation,
        currentOccupancy,
        exceededPage: page,
      };
    }
  }

  return {
    valid: true,
    proposedAllocation,
    currentOccupancy,
  };
}

/**
 * Menghitung posisi terakhir, status parsial, deteksi khatam 30 juz (halaman 604),
 * dan rekomendasi otomatis setoran SABAQ berikutnya.
 */
export function calculateLatestSabaqPosition(
  sabaqList: SetoranLikeRecord[],
  modalAwalHalaman: number,
  baselineDate?: Date | string | null
): SabaqPositionResult {
  const modalAwal = Math.max(0, Math.min(604, modalAwalHalaman || 0));
  const parsedBaseline = baselineDate ? new Date(baselineDate).getTime() : 0;

  // Filter Sabaq sah aktif pasca-baseline
  const activeSabaq = sabaqList.filter((s) => {
    if (s.status === "DIBATALKAN") return false;
    if (s.jenis !== "SABAQ") return false;
    if (parsedBaseline > 0 && s.tanggal) {
      return new Date(s.tanggal).getTime() >= parsedBaseline;
    }
    return true;
  });

  // Urutkan berdasarkan tanggal desc, createdAt desc
  activeSabaq.sort((a, b) => {
    const timeA = a.tanggal ? new Date(a.tanggal).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = b.tanggal ? new Date(b.tanggal).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    if (timeB !== timeA) return timeB - timeA;
    const crA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const crB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return crB - crA;
  });

  const occupancy = buildHistoricalPageOccupancy(activeSabaq, baselineDate);

  let posisiTerakhirHalaman = modalAwal;
  let isHalamanTerakhirParsial = false;

  if (activeSabaq.length > 0) {
    // Ambil halaman tertinggi dari setoran SABAQ yang sah
    const maxPage = Math.max(...activeSabaq.map((s) => s.halamanSelesai));
    posisiTerakhirHalaman = maxPage;
    const pageOccupancy = occupancy[posisiTerakhirHalaman] || 0;
    isHalamanTerakhirParsial = pageOccupancy > 0 && pageOccupancy < 0.999;
  }

  // Deteksi Santri yang telah menyelesaikan halaman terakhir (604 / 30 Juz Khatam)
  const isKhatam30Juz = posisiTerakhirHalaman >= 604 && !isHalamanTerakhirParsial;

  if (isKhatam30Juz) {
    return {
      posisiTerakhirHalaman: 604,
      isHalamanTerakhirParsial: false,
      isKhatam30Juz: true,
      saranHalamanMulai: null,
      saranJumlahHalaman: null,
      saranHalamanSelesai: null,
    };
  }

  let saranHalamanMulai: number;
  let saranJumlahHalaman: number;

  if (isHalamanTerakhirParsial && posisiTerakhirHalaman > 0) {
    // Masih ada sisa 0.5 halaman pada nomor halaman yang sama
    saranHalamanMulai = posisiTerakhirHalaman;
    saranJumlahHalaman = 0.5;
  } else if (posisiTerakhirHalaman === 0) {
    saranHalamanMulai = 1;
    saranJumlahHalaman = 1;
  } else {
    saranHalamanMulai = Math.min(604, posisiTerakhirHalaman + 1);
    saranJumlahHalaman = 1;
  }

  const saranHalamanSelesai =
    saranJumlahHalaman === 0.5
      ? saranHalamanMulai
      : saranHalamanMulai + Math.ceil(saranJumlahHalaman) - 1;

  return {
    posisiTerakhirHalaman,
    isHalamanTerakhirParsial,
    isKhatam30Juz: false,
    saranHalamanMulai,
    saranJumlahHalaman,
    saranHalamanSelesai,
  };
}
