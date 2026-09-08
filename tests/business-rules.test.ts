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

describe('Aturan Kelompok Halaqoh Pembina & Filter Santri (Google Sheets Riil)', () => {
  // Simulasi Master Data 57 Santri Sesuai Google Sheets
  const santriDataMaster = [
    // 1. Halaqoh Ust. Razan Mufli, S.Pd (5 Santri)
    { nis: 'SAN-0001', nama: 'Obama Ozearld Egberted Turizqi', halaqoh: 'Halaqoh Ust. Razan Mufli, S.Pd' },
    { nis: 'SAN-0002', nama: 'Muhammad Fardhan', halaqoh: 'Halaqoh Ust. Razan Mufli, S.Pd' },
    { nis: 'SAN-0003', nama: 'Muh. Fauzan', halaqoh: 'Halaqoh Ust. Razan Mufli, S.Pd' },
    { nis: 'SAN-0004', nama: 'Khubaib', halaqoh: 'Halaqoh Ust. Razan Mufli, S.Pd' },
    { nis: 'SAN-0005', nama: 'Abd. Riziq Ardi', halaqoh: 'Halaqoh Ust. Razan Mufli, S.Pd' },

    // 2. Halaqoh Ust. Kamal (9 Santri)
    { nis: 'SAN-0006', nama: 'Muhammad Amirul Hanif Al-Fatih', halaqoh: 'Halaqoh Ust. Kamal' },
    { nis: 'SAN-0007', nama: 'Muh. Riski Isral Wijaya', halaqoh: 'Halaqoh Ust. Kamal' },
    { nis: 'SAN-0008', nama: 'Muhammad Ridwan Kamil', halaqoh: 'Halaqoh Ust. Kamal' },
    { nis: 'SAN-0009', nama: 'Ahmad Ripai', halaqoh: 'Halaqoh Ust. Kamal' },
    { nis: 'SAN-0010', nama: 'Muhammad Mikhael', halaqoh: 'Halaqoh Ust. Kamal' },
    { nis: 'SAN-0011', nama: 'Arya Idris', halaqoh: 'Halaqoh Ust. Kamal' },
    { nis: 'SAN-0012', nama: "Muhammad Ghozy Ma'Arif", halaqoh: 'Halaqoh Ust. Kamal' },
    { nis: 'SAN-0013', nama: 'Muhammad Walied', halaqoh: 'Halaqoh Ust. Kamal' },
    { nis: 'SAN-0014', nama: 'Hilmy Mutawakkil Al Muntashir', halaqoh: 'Halaqoh Ust. Kamal' },

    // 3. Halaqoh Ust. Rizaldi (10 Santri)
    { nis: 'SAN-0015', nama: 'Achmad Sufiyan', halaqoh: 'Halaqoh Ust. Rizaldi' },
    { nis: 'SAN-0016', nama: 'Muh. Rifki Pria Herman', halaqoh: 'Halaqoh Ust. Rizaldi' },
    { nis: 'SAN-0017', nama: 'Muh Fadhlih Aksa', halaqoh: 'Halaqoh Ust. Rizaldi' },
    { nis: 'SAN-0018', nama: 'Muhammad Rizky Ashari', halaqoh: 'Halaqoh Ust. Rizaldi' },
    { nis: 'SAN-0019', nama: 'Hafidzh Asri', halaqoh: 'Halaqoh Ust. Rizaldi' },
    { nis: 'SAN-0020', nama: "Qonit Su'Adiy", halaqoh: 'Halaqoh Ust. Rizaldi' },
    { nis: 'SAN-0021', nama: 'Raja Muddin', halaqoh: 'Halaqoh Ust. Rizaldi' },
    { nis: 'SAN-0022', nama: 'M. Alief Pratama', halaqoh: 'Halaqoh Ust. Rizaldi' },
    { nis: 'SAN-0023', nama: 'Muh Fadhlan Aksa', halaqoh: 'Halaqoh Ust. Rizaldi' },
    { nis: 'SAN-0024', nama: 'Muhammad Azaky', halaqoh: 'Halaqoh Ust. Rizaldi' },

    // 4. Halaqoh Ust. Abi Hudzaifah (10 Santri)
    { nis: 'SAN-0025', nama: 'Syahrul Haq', halaqoh: 'Halaqoh Ust. Abi Hudzaifah' },
    { nis: 'SAN-0026', nama: 'Iksanul Haq', halaqoh: 'Halaqoh Ust. Abi Hudzaifah' },
    { nis: 'SAN-0027', nama: 'M. Alamsyah', halaqoh: 'Halaqoh Ust. Abi Hudzaifah' },
    { nis: 'SAN-0028', nama: 'Ahmad Fausan Al Farisi', halaqoh: 'Halaqoh Ust. Abi Hudzaifah' },
    { nis: 'SAN-0029', nama: 'Abdul Karim', halaqoh: 'Halaqoh Ust. Abi Hudzaifah' },
    { nis: 'SAN-0030', nama: 'Muhammad Asfa Ilham Ridwan', halaqoh: 'Halaqoh Ust. Abi Hudzaifah' },
    { nis: 'SAN-0031', nama: 'Khaerul Azam Abu Bakar', halaqoh: 'Halaqoh Ust. Abi Hudzaifah' },
    { nis: 'SAN-0032', nama: 'Muh. Alif Ihsan', halaqoh: 'Halaqoh Ust. Abi Hudzaifah' },
    { nis: 'SAN-0033', nama: 'Muh. Imran Maulana Sahid', halaqoh: 'Halaqoh Ust. Abi Hudzaifah' },
    { nis: 'SAN-0034', nama: 'Affan Garatta', halaqoh: 'Halaqoh Ust. Abi Hudzaifah' },

    // 5. Halaqoh Ust. Alwan (13 Santri)
    { nis: 'SAN-0035', nama: 'Laode Hisyam Arqana', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0036', nama: 'Xavier Omar Syarif Hidayatullah', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0037', nama: 'Muhammad Syafiq', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0038', nama: 'Andi Muhammad Ghazi Al Fatih', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0039', nama: 'Zulkifli', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0040', nama: 'M. Dzul Jalaali Walikhrom Rf', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0041', nama: 'Abdullah Khairun Nizham', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0042', nama: 'Andi Muh Rizky S', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0043', nama: 'Muhammad Rifky Firjatullah', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0044', nama: 'Rahmatullah S.', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0045', nama: 'Ade Naufal', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0046', nama: 'Hafiz Abd Aziz', halaqoh: 'Halaqoh Ust. Alwan' },
    { nis: 'SAN-0047', nama: 'Badar Fayyadh Nabil', halaqoh: 'Halaqoh Ust. Alwan' },

    // 6. Halaqoh Ustadzah Lisa Dwina Fitri (10 Santri)
    { nis: 'SAN-0048', nama: 'Habiba Asri', halaqoh: 'Halaqoh Ustadzah Lisa Dwina Fitri' },
    { nis: 'SAN-0049', nama: 'Meisya Arrahma', halaqoh: 'Halaqoh Ustadzah Lisa Dwina Fitri' },
    { nis: 'SAN-0050', nama: 'Rahmawati', halaqoh: 'Halaqoh Ustadzah Lisa Dwina Fitri' },
    { nis: 'SAN-0051', nama: 'Annisa Az Zahrah A.', halaqoh: 'Halaqoh Ustadzah Lisa Dwina Fitri' },
    { nis: 'SAN-0052', nama: 'Aisyah Muthmainnah', halaqoh: 'Halaqoh Ustadzah Lisa Dwina Fitri' },
    { nis: 'SAN-0053', nama: 'Nur Aqsa', halaqoh: 'Halaqoh Ustadzah Lisa Dwina Fitri' },
    { nis: 'SAN-0054', nama: 'Sri Ramadhaniyanti', halaqoh: 'Halaqoh Ustadzah Lisa Dwina Fitri' },
    { nis: 'SAN-0055', nama: 'Farhana', halaqoh: 'Halaqoh Ustadzah Lisa Dwina Fitri' },
    { nis: 'SAN-0056', nama: 'Rushaifa Rustam', halaqoh: 'Halaqoh Ustadzah Lisa Dwina Fitri' },
    { nis: 'SAN-0057', nama: 'Naafilah Kaltsum Aslan', halaqoh: 'Halaqoh Ustadzah Lisa Dwina Fitri' },
  ];

  function filterSantriByRoleOrStaff(role: string, currentStaffHalaqoh: string | null, halaqohFilter: string = 'ALL') {
    if (role === 'MT' || role === 'PH') {
      if (currentStaffHalaqoh) {
        return santriDataMaster.filter((s) => s.halaqoh === currentStaffHalaqoh);
      }
    }
    if (halaqohFilter && halaqohFilter !== 'ALL') {
      return santriDataMaster.filter((s) => s.halaqoh === halaqohFilter);
    }
    return santriDataMaster;
  }

  it('total master santri dari seluruh 6 halaqoh harus tepat 57 santri', () => {
    assert.equal(santriDataMaster.length, 57);
  });

  it('login sebagai Ust. Razan Mufli, S.Pd (MT) wajib mengisolasi hanya 5 santri halaqohnya', () => {
    const res = filterSantriByRoleOrStaff('MT', 'Halaqoh Ust. Razan Mufli, S.Pd');
    assert.equal(res.length, 5);
    assert.equal(res[0].nis, 'SAN-0001');
    assert.equal(res[4].nis, 'SAN-0005');
  });

  it('login sebagai Ust. Kamal (PH) wajib mengisolasi hanya 9 santri halaqohnya', () => {
    const res = filterSantriByRoleOrStaff('PH', 'Halaqoh Ust. Kamal');
    assert.equal(res.length, 9);
    assert.equal(res[0].nis, 'SAN-0006');
    assert.equal(res[8].nis, 'SAN-0014');
  });

  it('login sebagai Ust. Rizaldi (PH) wajib mengisolasi hanya 10 santri halaqohnya', () => {
    const res = filterSantriByRoleOrStaff('PH', 'Halaqoh Ust. Rizaldi');
    assert.equal(res.length, 10);
    assert.equal(res[0].nis, 'SAN-0015');
    assert.equal(res[9].nis, 'SAN-0024');
  });

  it('login sebagai Ust. Abi Hudzaifah (PH) wajib mengisolasi hanya 10 santri halaqohnya', () => {
    const res = filterSantriByRoleOrStaff('PH', 'Halaqoh Ust. Abi Hudzaifah');
    assert.equal(res.length, 10);
    assert.equal(res[0].nis, 'SAN-0025');
    assert.equal(res[9].nis, 'SAN-0034');
  });

  it('login sebagai Ust. Alwan (PH) wajib mengisolasi hanya 13 santri halaqohnya', () => {
    const res = filterSantriByRoleOrStaff('PH', 'Halaqoh Ust. Alwan');
    assert.equal(res.length, 13);
    assert.equal(res[0].nis, 'SAN-0035');
    assert.equal(res[12].nis, 'SAN-0047');
  });

  it('login sebagai Ustadzah Lisa Dwina Fitri (MT) wajib mengisolasi hanya 10 santriwati halaqohnya', () => {
    const res = filterSantriByRoleOrStaff('MT', 'Halaqoh Ustadzah Lisa Dwina Fitri');
    assert.equal(res.length, 10);
    assert.equal(res[0].nis, 'SAN-0048');
    assert.equal(res[9].nis, 'SAN-0057');
  });

  it('login sebagai Mudir (KS) atau Admin (ADM) dapat melihat seluruh 57 santri dan memfilter per halaqoh', () => {
    // Mode supervisi penuh (ALL)
    const allSantri = filterSantriByRoleOrStaff('KS', null, 'ALL');
    assert.equal(allSantri.length, 57);

    // Mudir memilih filter Halaqoh Ust. Kamal
    const filterKamal = filterSantriByRoleOrStaff('KS', null, 'Halaqoh Ust. Kamal');
    assert.equal(filterKamal.length, 9);
  });
});
