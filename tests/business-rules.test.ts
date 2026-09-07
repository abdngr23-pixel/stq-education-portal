import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Logika Bisnis Inti STQ Education Portal
 * Diuji sesuai spesifikasi dokumen PRD (01_PRD_STQ.md & 05_ROLE_PERMISSION_MATRIX.md)
 */

// 1. Logika Sanksi Pelanggaran (Doubling Poin)
function hitungPoinPelanggaran(poinDasar: number, isPengulangan: boolean): number {
  return isPengulangan ? poinDasar * 2 : poinDasar;
}

// 2. Ambang Batas Surat Peringatan (SP)
function evaluasiLevelSP(totalPoin: number): 'SP3' | 'SP2' | 'SP1' | null {
  if (totalPoin >= 100) return 'SP3';
  if (totalPoin >= 60) return 'SP2';
  if (totalPoin >= 30) return 'SP1';
  return null;
}

// 3. Konversi Nilai Akademik
function konversiPredikatNilai(angka: number): 'A' | 'B' | 'C' | 'D' {
  if (angka >= 85) return 'A';
  if (angka >= 70) return 'B';
  if (angka >= 60) return 'C';
  return 'D';
}

// 4. Aturan Perizinan Berjenjang
function validasiAlurPerizinan(jenisIzin: 'PULANG' | 'KELUAR_KOTA' | 'LOKAL', roleApprover: string, currentStatus: string) {
  if (jenisIzin === 'LOKAL') {
    // Izin lokal cukup disetujui Musyrif Kesantrian (MK)
    if (roleApprover === 'MK' || roleApprover === 'KS') {
      return { disetujui: true, statusBerikutnya: 'DISETUJUI' };
    }
    return { disetujui: false, error: 'Hanya MK atau KS yang berwenang menyetujui izin lokal' };
  } else {
    // Izin menginap / pulang harus disetujui MK terlebih dahulu, lalu dieskalasi ke KS
    if (currentStatus === 'MENUNGGU_MK' && roleApprover === 'MK') {
      return { disetujui: true, statusBerikutnya: 'MENUNGGU_KS' };
    }
    if (currentStatus === 'MENUNGGU_KS' && roleApprover === 'KS') {
      return { disetujui: true, statusBerikutnya: 'DISETUJUI' };
    }
    return { disetujui: false, error: 'Alur persetujuan tidak sesuai hierarki' };
  }
}

// 5. Validasi Ujian Ikhtibar 2 Tahap
function validasiIkhtibarTahap2(statusTahap1: string, nilaiTahap2: number) {
  if (statusTahap1 !== 'LULUS_TAHAP_1') {
    return { lulus: false, error: 'Santri harus dinyatakan lulus Tahap 1 oleh Musyrif sebelum diuji Mudir' };
  }
  if (nilaiTahap2 >= 75) {
    return { lulus: true, status: 'LULUS_MUNAASYAH', pesan: 'Alhamdulillah, santri dinyatakan Lulus Munaqasyah Juz' };
  }
  return { lulus: false, status: 'REMEDIAL_TAHAP_2', pesan: 'Santri perlu mengulang pengujian Tahap 2' };
}

// 6. Perhitungan Saldo Stok Logistik
function hitungMutasiStok(stokAwal: number, jenisMutasi: 'MASUK' | 'KELUAR', jumlah: number): number {
  if (jumlah <= 0) throw new Error('Jumlah mutasi harus lebih besar dari 0');
  if (jenisMutasi === 'MASUK') {
    return stokAwal + jumlah;
  } else {
    if (stokAwal < jumlah) throw new Error('Stok tidak mencukupi untuk pengeluaran');
    return stokAwal - jumlah;
  }
}

describe('Aturan Bisnis Kedisiplinan & Pelanggaran', () => {
  it('harus mengenakan poin dasar jika pelanggaran pertama kali', () => {
    const poin = hitungPoinPelanggaran(10, false);
    assert.equal(poin, 10);
  });

  it('harus melipatgandakan poin x2 jika pelanggaran pengulangan (isPengulangan = true)', () => {
    const poin = hitungPoinPelanggaran(10, true);
    assert.equal(poin, 20);
  });

  it('harus memicu SP1 pada akumulasi 30 poin', () => {
    assert.equal(evaluasiLevelSP(30), 'SP1');
    assert.equal(evaluasiLevelSP(45), 'SP1');
  });

  it('harus memicu SP2 pada akumulasi 60 poin', () => {
    assert.equal(evaluasiLevelSP(60), 'SP2');
    assert.equal(evaluasiLevelSP(99), 'SP2');
  });

  it('harus memicu SP3 pada akumulasi 100 poin atau lebih', () => {
    assert.equal(evaluasiLevelSP(100), 'SP3');
    assert.equal(evaluasiLevelSP(150), 'SP3');
  });

  it('tidak memicu SP jika total poin di bawah 30', () => {
    assert.equal(evaluasiLevelSP(25), null);
  });
});

describe('Aturan Akademik & Penilaian', () => {
  it('harus mengonversi angka >= 85 ke predikat A', () => {
    assert.equal(konversiPredikatNilai(90), 'A');
    assert.equal(konversiPredikatNilai(85), 'A');
  });

  it('harus mengonversi angka 70-84 ke predikat B', () => {
    assert.equal(konversiPredikatNilai(75), 'B');
    assert.equal(konversiPredikatNilai(84.9), 'B');
  });

  it('harus mengonversi angka 60-69 ke predikat C', () => {
    assert.equal(konversiPredikatNilai(65), 'C');
  });

  it('harus mengonversi angka < 60 ke predikat D (Remedial)', () => {
    assert.equal(konversiPredikatNilai(55), 'D');
  });
});

describe('Aturan Perizinan Santri Berjenjang', () => {
  it('izin lokal dapat langsung disetujui oleh Musyrif Kesantrian (MK)', () => {
    const res = validasiAlurPerizinan('LOKAL', 'MK', 'MENUNGGU_MK');
    assert.equal(res.disetujui, true);
    assert.equal(res.statusBerikutnya, 'DISETUJUI');
  });

  it('izin pulang harus dieskalasi dari MK ke KS (Mudir)', () => {
    const step1 = validasiAlurPerizinan('PULANG', 'MK', 'MENUNGGU_MK');
    assert.equal(step1.disetujui, true);
    assert.equal(step1.statusBerikutnya, 'MENUNGGU_KS');

    const step2 = validasiAlurPerizinan('PULANG', 'KS', 'MENUNGGU_KS');
    assert.equal(step2.disetujui, true);
    assert.equal(step2.statusBerikutnya, 'DISETUJUI');
  });

  it('guru akademik (GA) tidak boleh menyetujui izin pulang', () => {
    const res = validasiAlurPerizinan('PULANG', 'GA', 'MENUNGGU_MK');
    assert.equal(res.disetujui, false);
  });
});

describe('Aturan Ujian Ikhtibar Tahfizh 2 Tahap', () => {
  it('santri tidak boleh diuji oleh Mudir jika belum lulus Tahap 1', () => {
    const res = validasiIkhtibarTahap2('MENUNGGU_TAHAP_1', 85);
    assert.equal(res.lulus, false);
  });

  it('santri yang lulus Tahap 1 dan mendapat nilai Tahap 2 >= 75 dinyatakan Lulus Munaqasyah', () => {
    const res = validasiIkhtibarTahap2('LULUS_TAHAP_1', 88);
    assert.equal(res.lulus, true);
    assert.equal(res.status, 'LULUS_MUNAASYAH');
  });
});

describe('Aturan Inventaris & Logistik Asrama', () => {
  it('harus menambah stok dengan benar pada mutasi MASUK', () => {
    const saldo = hitungMutasiStok(50, 'MASUK', 25);
    assert.equal(saldo, 75);
  });

  it('harus mengurangi stok dengan benar pada mutasi KELUAR', () => {
    const saldo = hitungMutasiStok(50, 'KELUAR', 20);
    assert.equal(saldo, 30);
  });

  it('harus melempar error jika pengeluaran melebihi stok yang tersedia', () => {
    assert.throws(() => {
      hitungMutasiStok(10, 'KELUAR', 15);
    }, /Stok tidak mencukupi/);
  });
});
