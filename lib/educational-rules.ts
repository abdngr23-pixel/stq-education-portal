/**
 * Centralized Educational Business Rules
 * STQ Education Portal
 *
 * Sesuai temuan A17 Audit STQ 2026-09-08:
 * Ambang batas Surat Peringatan (SP), predikat nilai akademik,
 * aturan doubling sanksi pelanggaran, perizinan, dan ikhtibar
 * diekstrak ke satu modul bersama yang dipakai oleh produksi dan diuji oleh automated tests.
 */

/**
 * Status Formal Konsolidasi Aturan Pendidikan:
 * Seluruh ambang batas yang memerlukan payung hukum formal diberi status eksplisit
 * MENUNGGU KONFIRMASI PENGURUS hingga terbit SK resmi Mudir / Pengurus Yayasan.
 */
export const STATUS_ATURAN = 'MENUNGGU KONFIRMASI PENGURUS' as const;

/**
 * 1. Ambang Batas Poin Surat Peringatan (SP)
 * STATUS: MENUNGGU KONFIRMASI PENGURUS
 * Catatan: Dokumen README lama menyebut SP1/SP2/SP3 pada 30/60/100 poin,
 * sedangkan implementasi kode saat ini menggunakan 20/40/60 poin.
 * Angka 20/40/60 dipertahankan sementara secara konsisten di UI, backend, laporan, dan pengujian
 * hingga disahkan melalui Surat Keputusan / Kebijakan Lembaga resmi.
 */
export const SP_THRESHOLDS = {
  SP1: 20,
  SP2: 40,
  SP3: 60,
} as const;

export const STATUS_ATURAN_PENDIDIKAN = {
  status: STATUS_ATURAN,
  sp: {
    status: STATUS_ATURAN,
    thresholds: SP_THRESHOLDS,
    keterangan: 'Ambang batas 20 (SP1), 40 (SP2), 60 (SP3) poin menunggu SK resmi Mudir / Pengurus Yayasan.',
  },
  nilai: {
    status: STATUS_ATURAN,
    thresholds: {
      A: 90,
      B: 80,
      C: 70,
    } as const,
    keterangan: 'Skala predikat A (>=90), B (>=80), C (>=70), D (<70) menunggu pengesahan KKM kurikulum definitif.',
  },
} as const;

export function evaluasiLevelSP(totalPoin: number): 'SP3' | 'SP2' | 'SP1' | null {
  if (totalPoin >= SP_THRESHOLDS.SP3) return 'SP3';
  if (totalPoin >= SP_THRESHOLDS.SP2) return 'SP2';
  if (totalPoin >= SP_THRESHOLDS.SP1) return 'SP1';
  return null;
}

/**
 * 2. Ambang Batas Predikat Nilai Akademik
 * STATUS: MENUNGGU KONFIRMASI PENGURUS
 * Angka A (>=90), B (>=80), C (>=70), D (<70) dipertahankan sementara secara konsisten
 * di UI, backend, cetak rapor, dan tes hingga ada pengesahan KKM baku dari rapat kurikulum.
 */
export const NILAI_THRESHOLDS = {
  A: 90,
  B: 80,
  C: 70,
} as const;

export function konversiPredikatNilai(angka: number): 'A' | 'B' | 'C' | 'D' {
  if (angka >= NILAI_THRESHOLDS.A) return 'A';
  if (angka >= NILAI_THRESHOLDS.B) return 'B';
  if (angka >= NILAI_THRESHOLDS.C) return 'C';
  return 'D';
}

// 3. Logika Sanksi Pelanggaran (Deteksi Pengulangan Berbobot Ganda)
export function hitungPoinPelanggaran(poinDasar: number, isPengulangan: boolean): number {
  return isPengulangan ? poinDasar * 2 : poinDasar;
}

// 4. Aturan Perizinan Berjenjang Santri
export interface ValidasiIzinResult {
  disetujui: boolean;
  statusBerikutnya?: string;
  error?: string;
}

export function validasiAlurPerizinan(
  jenisIzin: 'PULANG' | 'KELUAR_KOMPLEK' | 'KELUAR_KOTA' | 'LOKAL' | 'SAKIT' | 'TUGAS_PONDOK',
  roleApprover: string,
  currentStatus: string
): ValidasiIzinResult {
  // Izin lokal/keluar komplek/sakit/tugas pondok cukup disetujui Musyrif Kesantrian (MK) atau Mudir (KS)
  if (jenisIzin === 'LOKAL' || jenisIzin === 'KELUAR_KOMPLEK' || jenisIzin === 'SAKIT' || jenisIzin === 'TUGAS_PONDOK') {
    if (roleApprover === 'MK' || roleApprover === 'KS') {
      return { disetujui: true, statusBerikutnya: 'DISETUJUI' };
    }
    return { disetujui: false, error: 'Hanya MK atau KS yang berwenang menyetujui izin lokal/keluar komplek.' };
  }

  // Izin menginap / pulang harus bertahap disetujui MK dahulu, lalu Mudir (KS)
  if (jenisIzin === 'PULANG' || jenisIzin === 'KELUAR_KOTA') {
    if (currentStatus === 'MENUNGGU_MK' && roleApprover === 'MK') {
      return { disetujui: true, statusBerikutnya: 'MENUNGGU_KS' };
    }
    if (currentStatus === 'MENUNGGU_KS' && roleApprover === 'KS') {
      return { disetujui: true, statusBerikutnya: 'DISETUJUI' };
    }
    return { disetujui: false, error: 'Alur persetujuan izin pulang tidak sesuai hierarki berjenjang (MK -> KS).' };
  }

  return { disetujui: false, error: 'Jenis izin tidak dikenali.' };
}

// 5. Validasi Ujian Ikhtibar 2 Tahap (Ambang Batas Lulus >= 75)
export const MIN_NILAI_IKHTIBAR = 75;

export interface ValidasiIkhtibarResult {
  lulus: boolean;
  status: string;
  pesan: string;
  error?: string;
}

export function validasiIkhtibarTahap1(
  currentStatus: string,
  nilaiTahap1: number
): ValidasiIkhtibarResult {
  if (currentStatus !== 'PENGAJUAN') {
    return {
      lulus: false,
      status: currentStatus,
      pesan: 'Status ikhtibar tidak dalam status PENGAJUAN.',
      error: 'Ujian Tahap 1 hanya dapat dilakukan untuk pendaftaran berstatus PENGAJUAN.',
    };
  }

  if (nilaiTahap1 < 0 || nilaiTahap1 > 100) {
    return {
      lulus: false,
      status: currentStatus,
      pesan: 'Rentang nilai tidak valid.',
      error: 'Nilai harus berada pada rentang 0 sampai 100.',
    };
  }

  if (nilaiTahap1 >= MIN_NILAI_IKHTIBAR) {
    return {
      lulus: true,
      status: 'LULUS_TAHAP_1',
      pesan: 'Alhamdulillah, santri dinyatakan LULUS Tahap 1 dan siap diuji oleh Mudir.',
    };
  }

  return {
    lulus: false,
    status: 'MENGULANG',
    pesan: `Nilai (${nilaiTahap1}) di bawah standar kelulusan (${MIN_NILAI_IKHTIBAR}). Santri harus mengulang Ujian Tahap 1.`,
  };
}

export type HasilTahap2Type = 'LULUS' | 'MENGULANG_SEBAGIAN' | 'MENGULANG_SATU_JUZ';

export function validasiIkhtibarTahap2(
  currentStatus: string,
  nilaiTahap2: number,
  jenisHasil?: HasilTahap2Type
): ValidasiIkhtibarResult {
  if (currentStatus !== 'LULUS_TAHAP_1') {
    return {
      lulus: false,
      status: currentStatus,
      pesan: 'Santri harus telah lulus Ujian Tahap 1 sebelum diuji oleh Mudir.',
      error: 'Santri harus dinyatakan lulus Tahap 1 oleh Musyrif sebelum diuji Mudir.',
    };
  }

  if (nilaiTahap2 < 0 || nilaiTahap2 > 100) {
    return {
      lulus: false,
      status: currentStatus,
      pesan: 'Rentang nilai tidak valid.',
      error: 'Nilai harus berada pada rentang 0 sampai 100.',
    };
  }

  // Jika Mudir menentukan eksplisit jenis hasil ujian
  if (jenisHasil === 'LULUS' || (!jenisHasil && nilaiTahap2 >= MIN_NILAI_IKHTIBAR)) {
    return {
      lulus: true,
      status: 'LULUS_SEMPURNA_TAHAP_2',
      pesan: 'Alhamdulillah, santri dinyatakan RESMI LULUS SELESAI JUZ oleh Mudir Pesantren.',
    };
  }

  if (jenisHasil === 'MENGULANG_SEBAGIAN') {
    return {
      lulus: false,
      status: 'MENGULANG_SEBAGIAN',
      pesan: `Hasil Ujian Tahap II: Santri diminta mengulang sebagian maqra/halaman pada Juz tersebut.`,
    };
  }

  if (jenisHasil === 'MENGULANG_SATU_JUZ') {
    return {
      lulus: false,
      status: 'MENGULANG_SATU_JUZ',
      pesan: `Hasil Ujian Tahap II: Santri diminta mengulang satu juz penuh sebelum mendaftar ikhtibar kembali.`,
    };
  }

  // Fallback proporsional jika belum mencapai 75 dan tidak ditentukan spesifik
  const autoStatus = nilaiTahap2 >= 60 ? 'MENGULANG_SEBAGIAN' : 'MENGULANG_SATU_JUZ';
  return {
    lulus: false,
    status: autoStatus,
    pesan: `Nilai (${nilaiTahap2}) di bawah standar kelulusan (${MIN_NILAI_IKHTIBAR}). Keputusan: ${
      autoStatus === 'MENGULANG_SEBAGIAN' ? 'Mengulang Sebagian Maqra' : 'Mengulang Satu Juz Penuh'
    }.`,
  };
}
