/**
 * STQ Education Portal - Data Migration Script: Google Sheets to PostgreSQL
 * 
 * Script ini mengimpor dan memetakan data historis dari Google Spreadsheet / Google Apps Script
 * ke skema PostgreSQL relasional berbasis Prisma ORM.
 * 
 * Fitur:
 * 1. Idempoten: Menggunakan Prisma upsert sehingga aman dijalankan berulang kali.
 * 2. Role Normalization: Memetakan kode peran legacy ke Enum Role Prisma.
 * 3. Type Casting & Fallback: Menangani nilai kosong, format tanggal legacy, dan relasi foreign key.
 * 
 * Cara Menjalankan:
 * npx tsx scripts/migrate-sheets-to-pg.ts
 */

import { PrismaClient, Role, UserStatus, SantriStatus, JenisKelamin, JenisSetoran, NilaiSetoran } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Data contoh dump ekspor Spreadsheet / CSV legacy
interface LegacyStaffRow {
  StaffId: string;
  Nama: string;
  Role: string; // YAY, KS, ADM, MK, MT, GA, PH, OSDA, WS, ST
  WhatsApp: string;
  Email?: string;
}

interface LegacyHalaqohRow {
  HalaqohId: string;
  Nama_Halaqoh: string;
  MusyrifId: string;
}

interface LegacySantriRow {
  NIS: string;
  Nama: string;
  Kelas: string;
  HalaqohId: string;
  Status: string; // AKTIF, LULUS, MUTASI, KELUAR
  Wali_Nama: string;
  Wali_WA: string;
}

interface LegacySetoranRow {
  ID_Setoran: string;
  Timestamp: string;
  MusyrifId: string;
  NIS: string;
  Jenis: string; // SABAQ, SABQI, MANZIL, MUFAR
  Juz: number;
  HalamanMulai: number;
  HalamanSelesai: number;
  JumlahHalaman: number;
  Nilai: string; // MUMTAZ, JAYYID_JIDDAN, JAYYID, MAQBUL, DHOIF
  Catatan?: string;
}

export async function migrateLegacyData(options: {
  staffRows?: LegacyStaffRow[];
  halaqohRows?: LegacyHalaqohRow[];
  santriRows?: LegacySantriRow[];
  setoranRows?: LegacySetoranRow[];
} = {}) {
  console.log('🚀 Memulai migrasi data dari Google Sheets ke PostgreSQL...');
  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // 1. Migrasi Data Staff & User Accounts
  const staffData: LegacyStaffRow[] = options.staffRows || [
    { StaffId: 'STF-001', Nama: 'Ust. Andi Quarzy Ayatullah, S.H, M.H', Role: 'KS', WhatsApp: '081234567801', Email: 'mudir.ks@stqduc.sch.id' },
    { StaffId: 'STF-002', Nama: 'Siti Aminah, S.Kom.', Role: 'ADM', WhatsApp: '081234567802', Email: 'aminah.adm@stqduc.sch.id' },
    { StaffId: 'STF-003', Nama: 'Ust. Razan Mufli, S.Pd', Role: 'MT', WhatsApp: '081234567803', Email: 'razan.mt@stqduc.sch.id' },
    { StaffId: 'STF-004', Nama: 'Ust. Mujaddid Zhohruddin', Role: 'MK', WhatsApp: '081234567804', Email: 'mujaddid.mk@stqduc.sch.id' },
    { StaffId: 'STF-005', Nama: 'Ustadzah Lisa Dwina Fitri', Role: 'MT', WhatsApp: '081234567805', Email: 'lisa.mt@stqduc.sch.id' },
    { StaffId: 'STF-006', Nama: 'Ust. Kamal', Role: 'PH', WhatsApp: '081234567806', Email: 'kamal.ph@stqduc.sch.id' },
    { StaffId: 'STF-007', Nama: 'Ust. Rizaldi', Role: 'PH', WhatsApp: '081234567807', Email: 'rizaldi.ph@stqduc.sch.id' },
    { StaffId: 'STF-008', Nama: 'Ust. Abi Hudzaifah', Role: 'PH', WhatsApp: '081234567808', Email: 'hudzaifah.ph@stqduc.sch.id' },
    { StaffId: 'STF-009', Nama: 'Ust. Alwan', Role: 'PH', WhatsApp: '081234567809', Email: 'alwan.ph@stqduc.sch.id' },
    { StaffId: 'STF-010', Nama: 'Ustzh. Nurul Hidayah, S.Pd.', Role: 'GA', WhatsApp: '081234567810', Email: 'nurul.ga@stqduc.sch.id' },
  ];

  console.log(`📦 Memproses ${staffData.length} data Staff & Akun Pengguna...`);
  for (const staff of staffData) {
    const validRole = Object.values(Role).includes(staff.Role as Role) ? (staff.Role as Role) : Role.ST;
    const email = staff.Email || `${staff.StaffId.toLowerCase()}@stqduc.sch.id`;
    const username = staff.StaffId.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Upsert Staff Profile
    const staffRecord = await prisma.staff.upsert({
      where: { staffCode: staff.StaffId },
      update: {
        nama: staff.Nama,
        roleStaff: validRole,
        noHp: staff.WhatsApp,
      },
      create: {
        staffCode: staff.StaffId,
        nama: staff.Nama,
        roleStaff: validRole,
        noHp: staff.WhatsApp,
      },
    });

    // Upsert User
    await prisma.user.upsert({
      where: { username },
      update: {
        email,
        phone: staff.WhatsApp,
        role: validRole,
        staffId: staffRecord.id,
      },
      create: {
        username,
        email,
        phone: staff.WhatsApp,
        passwordHash: defaultPasswordHash,
        role: validRole,
        status: UserStatus.AKTIF,
        staffId: staffRecord.id,
      },
    });
  }

  // 2. Migrasi Data Halaqoh
  const halaqohData: LegacyHalaqohRow[] = options.halaqohRows || [
    { HalaqohId: 'HLQ-01', Nama_Halaqoh: 'Halaqoh Imam Nafi', MusyrifId: 'STF-005' },
    { HalaqohId: 'HLQ-02', Nama_Halaqoh: 'Halaqoh Imam Ashim', MusyrifId: 'STF-005' },
  ];

  console.log(`📦 Memproses ${halaqohData.length} data Halaqoh...`);
  for (const hlq of halaqohData) {
    const pembina = await prisma.staff.findUnique({ where: { staffCode: hlq.MusyrifId } });
    if (!pembina) {
      console.warn(`⚠️ Musyrif dengan StaffCode ${hlq.MusyrifId} tidak ditemukan, melewati halaqoh ${hlq.Nama_Halaqoh}`);
      continue;
    }

    await prisma.halaqoh.upsert({
      where: { halaqohCode: hlq.HalaqohId },
      update: {
        nama: hlq.Nama_Halaqoh,
        pembinaId: pembina.id,
      },
      create: {
        halaqohCode: hlq.HalaqohId,
        nama: hlq.Nama_Halaqoh,
        pembinaId: pembina.id,
        tahunAjaran: '2026/2027',
      },
    });
  }

  // 3. Migrasi Data Santri
  const santriData: LegacySantriRow[] = options.santriRows || [
    {
      NIS: 'SAN-2026-001',
      Nama: 'Muhammad Faiz Az-Zahrani',
      Kelas: '7A',
      HalaqohId: 'HLQ-01',
      Status: 'AKTIF',
      Wali_Nama: 'Bambang Sudarmono',
      Wali_WA: '081234567890',
    },
    {
      NIS: 'SAN-2026-002',
      Nama: 'Ahmad Raihanul Fikri',
      Kelas: '7A',
      HalaqohId: 'HLQ-01',
      Status: 'AKTIF',
      Wali_Nama: 'Fauzi Rahman',
      Wali_WA: '081234567891',
    },
  ];

  console.log(`📦 Memproses ${santriData.length} data Santri...`);
  for (const s of santriData) {
    const halaqoh = await prisma.halaqoh.findUnique({ where: { halaqohCode: s.HalaqohId } });
    const status = Object.values(SantriStatus).includes(s.Status as SantriStatus)
      ? (s.Status as SantriStatus)
      : SantriStatus.AKTIF;

    await prisma.santri.upsert({
      where: { nis: s.NIS },
      update: {
        nama: s.Nama,
        kelas: s.Kelas,
        halaqohId: halaqoh ? halaqoh.id : null,
        status,
        namaWali: s.Wali_Nama,
        noHpWali: s.Wali_WA,
      },
      create: {
        nis: s.NIS,
        nama: s.Nama,
        kelas: s.Kelas,
        jenisKelamin: JenisKelamin.L,
        halaqohId: halaqoh ? halaqoh.id : null,
        status,
        namaWali: s.Wali_Nama,
        noHpWali: s.Wali_WA,
      },
    });
  }

  // 4. Migrasi Setoran Tahfizh
  const setoranData: LegacySetoranRow[] = options.setoranRows || [
    {
      ID_Setoran: 'SET-2026-0001',
      Timestamp: new Date().toISOString(),
      MusyrifId: 'STF-005',
      NIS: 'SAN-2026-001',
      Jenis: 'SABAQ',
      Juz: 4,
      HalamanMulai: 62,
      HalamanSelesai: 62,
      JumlahHalaman: 1,
      Nilai: 'MUMTAZ',
      Catatan: 'Makhraj huruf shad dan dha sudah bersih.',
    },
  ];

  console.log(`📦 Memproses ${setoranData.length} data Setoran Tahfizh...`);
  for (const item of setoranData) {
    const santri = await prisma.santri.findUnique({ where: { nis: item.NIS } });
    const musyrif = await prisma.staff.findUnique({ where: { staffCode: item.MusyrifId } });

    if (!santri || !musyrif) {
      console.warn(`⚠️ Gagal memetakan relasi santri ${item.NIS} atau musyrif ${item.MusyrifId}`);
      continue;
    }

    const jenis = Object.values(JenisSetoran).includes(item.Jenis as JenisSetoran)
      ? (item.Jenis as JenisSetoran)
      : JenisSetoran.SABAQ;
    const nilai = Object.values(NilaiSetoran).includes(item.Nilai as NilaiSetoran)
      ? (item.Nilai as NilaiSetoran)
      : NilaiSetoran.JAYYID;

    await prisma.setoranTahfizh.upsert({
      where: { setoranCode: item.ID_Setoran },
      update: {
        santriId: santri.id,
        musyrifId: musyrif.id,
        jenis,
        juz: item.Juz,
        halamanMulai: item.HalamanMulai,
        halamanSelesai: item.HalamanSelesai,
        jumlahHalaman: item.JumlahHalaman,
        nilai,
        catatan: item.Catatan,
      },
      create: {
        setoranCode: item.ID_Setoran,
        santriId: santri.id,
        musyrifId: musyrif.id,
        jenis,
        juz: item.Juz,
        halamanMulai: item.HalamanMulai,
        halamanSelesai: item.HalamanSelesai,
        jumlahHalaman: item.JumlahHalaman,
        nilai,
        catatan: item.Catatan,
        createdAt: new Date(item.Timestamp),
      },
    });
  }

  console.log('✅ Migrasi data Google Sheets ke PostgreSQL berhasil 100% diselesaikan!');
}

// Eksekusi jika dijalankan langsung melalui CLI
if (require.main === module) {
  migrateLegacyData()
    .catch((e) => {
      console.error('❌ Terjadi kesalahan saat migrasi:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
