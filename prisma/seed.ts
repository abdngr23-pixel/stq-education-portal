import {
  PrismaClient,
  Role,
  UserStatus,
  SantriStatus,
  JenisKelamin,
  JenisSetoran,
  NilaiSetoran,
  KategoriMapel,
  JenisNilai,
  JenisIzin,
  StatusIzin,
  StatusAbsensi,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Mulai proses seeding database STQ Portal (Fase 1 & Fase 2)...");

  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  // 1. Bersihkan data lama sesuai urutan relasi
  await prisma.auditLog.deleteMany();
  await prisma.absensi.deleteMany();
  await prisma.perizinanSantri.deleteMany();
  await prisma.nilaiAkademik.deleteMany();
  await prisma.mataPelajaran.deleteMany();
  await prisma.setoranTahfizh.deleteMany();
  await prisma.santri.deleteMany();
  await prisma.halaqoh.deleteMany();
  await prisma.user.deleteMany();
  await prisma.staff.deleteMany();

  console.log("🧹 Tabel lama berhasil dibersihkan.");

  // 2. Buat Staff Master Data
  const staffKS = await prisma.staff.create({
    data: {
      staffCode: "STF-0001",
      nama: "Ust. H. Ahmad Fauzi, Lc., M.Pd.",
      noHp: "081234567801",
      roleStaff: Role.KS,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffADM = await prisma.staff.create({
    data: {
      staffCode: "STF-0002",
      nama: "Siti Aminah, S.Kom.",
      noHp: "081234567802",
      roleStaff: Role.ADM,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffMT1 = await prisma.staff.create({
    data: {
      staffCode: "STF-0003",
      nama: "Ust. Zulkifli Al-Hafizh",
      noHp: "081234567803",
      roleStaff: Role.MT,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffMT2 = await prisma.staff.create({
    data: {
      staffCode: "STF-0004",
      nama: "Ust. Bilal Habibi, S.Ag.",
      noHp: "081234567804",
      roleStaff: Role.MT,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffMK = await prisma.staff.create({
    data: {
      staffCode: "STF-0005",
      nama: "Ust. Hamzah Pratama",
      noHp: "081234567805",
      roleStaff: Role.MK,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffGA = await prisma.staff.create({
    data: {
      staffCode: "STF-0006",
      nama: "Ustzh. Nurul Hidayah, S.Pd.",
      noHp: "081234567806",
      roleStaff: Role.GA,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  console.log("✅ Data master Staff berhasil dibuat.");

  // 3. Buat Halaqoh
  const halaqohUtsman = await prisma.halaqoh.create({
    data: {
      halaqohCode: "HLQ-0001",
      nama: "Halaqoh Utsman bin Affan",
      pembinaId: staffMT1.id,
      tahunAjaran: "2026/2027",
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const halaqohAli = await prisma.halaqoh.create({
    data: {
      halaqohCode: "HLQ-0002",
      nama: "Halaqoh Ali bin Abi Thalib",
      pembinaId: staffMT2.id,
      tahunAjaran: "2026/2027",
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  console.log("✅ Data master Halaqoh berhasil dibuat.");

  // 4. Buat Santri
  const santri1 = await prisma.santri.create({
    data: {
      nis: "SAN-0001",
      nama: "Muhammad Fatih Al-Ayyubi",
      kelas: "7A",
      jenisKelamin: JenisKelamin.L,
      status: SantriStatus.AKTIF,
      isYatimDhuafa: false,
      namaWali: "Hendra Wijaya",
      noHpWali: "081399887701",
      halaqohId: halaqohUtsman.id,
      createdBy: "SYSTEM",
    },
  });

  const santri2 = await prisma.santri.create({
    data: {
      nis: "SAN-0002",
      nama: "Ahmad Ziyad Rahman",
      kelas: "8B",
      jenisKelamin: JenisKelamin.L,
      status: SantriStatus.AKTIF,
      isYatimDhuafa: false,
      namaWali: "Bambang Santoso",
      noHpWali: "081399887702",
      halaqohId: halaqohUtsman.id,
      createdBy: "SYSTEM",
    },
  });

  const santri3 = await prisma.santri.create({
    data: {
      nis: "SAN-0003",
      nama: "Zaidan Al-Farisi",
      kelas: "7A",
      jenisKelamin: JenisKelamin.L,
      status: SantriStatus.AKTIF,
      isYatimDhuafa: true,
      namaWali: "Fatimah Azzahra",
      noHpWali: "081399887703",
      halaqohId: halaqohUtsman.id,
      createdBy: "SYSTEM",
    },
  });

  const santri4 = await prisma.santri.create({
    data: {
      nis: "SAN-0004",
      nama: "Umar Hamizan",
      kelas: "8A",
      jenisKelamin: JenisKelamin.L,
      status: SantriStatus.AKTIF,
      isYatimDhuafa: false,
      namaWali: "Ridwan Kamil",
      noHpWali: "081399887704",
      halaqohId: halaqohAli.id,
      createdBy: "SYSTEM",
    },
  });

  console.log("✅ Data master Santri berhasil dibuat.");

  // 5. Buat User Accounts untuk 10 Role
  const usersData = [
    { username: "mudir", email: "mudir@duc-tahfizh.sch.id", role: Role.KS, staffId: staffKS.id },
    { username: "admin", email: "admin@duc-tahfizh.sch.id", role: Role.ADM, staffId: staffADM.id },
    { username: "musyrif.tahfizh", email: "musyrif.tahfizh@duc-tahfizh.sch.id", role: Role.MT, staffId: staffMT1.id },
    { username: "musyrif.asrama", email: "musyrif.asrama@duc-tahfizh.sch.id", role: Role.MK, staffId: staffMK.id },
    { username: "guru.akademik", email: "guru@duc-tahfizh.sch.id", role: Role.GA, staffId: staffGA.id },
    { username: "yayasan", email: "yayasan@duc-tahfizh.sch.id", role: Role.YAY },
    { username: "pembina.halaqoh", email: "pembina@duc-tahfizh.sch.id", role: Role.PH },
    { username: "osda", email: "osda@duc-tahfizh.sch.id", role: Role.OSDA },
    { username: "walisantri", email: "wali.fatih@gmail.com", role: Role.WS },
    { username: "santri.fatih", email: "fatih@duc-tahfizh.sch.id", role: Role.ST, santriId: santri1.id },
  ];

  for (const u of usersData) {
    await prisma.user.create({
      data: {
        username: u.username,
        email: u.email,
        passwordHash: defaultPasswordHash,
        role: u.role,
        status: UserStatus.AKTIF,
        staffId: u.staffId,
        santriId: u.santriId,
      },
    });
  }

  console.log("✅ 10 Akun pengguna berhasil dibuat (Password: 'password123').");

  // 6. Buat Sample Setoran Tahfizh
  await prisma.setoranTahfizh.create({
    data: {
      setoranCode: "SET-000001",
      santriId: santri1.id,
      musyrifId: staffMT1.id,
      tanggal: new Date(),
      jenis: JenisSetoran.SABAQ,
      juz: 4,
      surahMulai: "Ali 'Imran",
      ayatMulai: 1,
      surahSelesai: "Ali 'Imran",
      ayatSelesai: 20,
      nilai: NilaiSetoran.MUMTAZ,
      catatan: "Bacaan sangat tartil, makhrojul huruf dan mad thobi'i tepat.",
      createdBy: staffMT1.staffCode,
    },
  });

  // 7. FASE 2: Mata Pelajaran
  const mapelFiqih = await prisma.mataPelajaran.create({
    data: {
      kodeMapel: "MP-DIN-01",
      nama: "Fiqih Ibadah",
      kategori: KategoriMapel.DINIYAH,
      guruId: staffGA.id,
    },
  });

  const mapelArab = await prisma.mataPelajaran.create({
    data: {
      kodeMapel: "MP-DIN-02",
      nama: "Bahasa Arab & Nahwu",
      kategori: KategoriMapel.DINIYAH,
      guruId: staffGA.id,
    },
  });

  const mapelMTK = await prisma.mataPelajaran.create({
    data: {
      kodeMapel: "MP-UM-01",
      nama: "Matematika Terapan",
      kategori: KategoriMapel.UMUM,
      guruId: staffGA.id,
    },
  });

  const mapelAdab = await prisma.mataPelajaran.create({
    data: {
      kodeMapel: "MP-PES-01",
      nama: "Adab & Kepesantrenan",
      kategori: KategoriMapel.KEPESANTRENAN,
      guruId: staffKS.id,
    },
  });

  console.log("✅ Mata Pelajaran Fase 2 berhasil dibuat.");

  // 8. FASE 2: Nilai Akademik
  await prisma.nilaiAkademik.create({
    data: {
      santriId: santri1.id,
      mapelId: mapelFiqih.id,
      guruId: staffGA.id,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.UTS,
      angka: 92,
      huruf: "A",
      catatan: "Pemahaman thoharoh dan sholat sangat baik.",
    },
  });

  await prisma.nilaiAkademik.create({
    data: {
      santriId: santri1.id,
      mapelId: mapelArab.id,
      guruId: staffGA.id,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.UTS,
      angka: 88,
      huruf: "A",
      catatan: "Kaidah nahwu dasar dipahami dengan lancar.",
    },
  });

  await prisma.nilaiAkademik.create({
    data: {
      santriId: santri1.id,
      mapelId: mapelMTK.id,
      guruId: staffGA.id,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.UTS,
      angka: 85,
      huruf: "B",
      catatan: "Teliti dalam menyelesaikan soal logika.",
    },
  });

  await prisma.nilaiAkademik.create({
    data: {
      santriId: santri1.id,
      mapelId: mapelAdab.id,
      guruId: staffKS.id,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.KEAKTIFAN,
      angka: 95,
      huruf: "A",
      catatan: "Keteladanan adab terhadap ustadz dan sesama santri sangat memuaskan.",
    },
  });

  console.log("✅ Nilai Akademik Santri Fase 2 berhasil dibuat.");

  // 9. FASE 2: Perizinan Santri Berjenjang
  await prisma.perizinanSantri.create({
    data: {
      kodeIzin: "IZN-000001",
      santriId: santri3.id,
      jenis: JenisIzin.SAKIT,
      tanggalMulai: new Date(),
      tanggalSelesai: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      alasan: "Demam dan flu, istirahat di UKS / pengawasan klinik pesantren.",
      status: StatusIzin.DISETUJUI,
      disetujuiMKId: staffMK.id,
      catatan: "Telah diperiksa dokter klinik pesantren.",
    },
  });

  await prisma.perizinanSantri.create({
    data: {
      kodeIzin: "IZN-000002",
      santriId: santri1.id,
      jenis: JenisIzin.PULANG,
      tanggalMulai: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      tanggalSelesai: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      alasan: "Acara pernikahan kakak kandung di luar kota.",
      status: StatusIzin.MENUNGGU_KS,
      disetujuiMKId: staffMK.id,
      catatan: "Musyrif Asrama menyetujui, menunggu verifikasi eskalasi Mudir/KS.",
    },
  });

  console.log("✅ Perizinan Santri Berjenjang berhasil dibuat.");

  // 10. FASE 2: Absensi Santri
  await prisma.absensi.create({
    data: {
      santriId: santri1.id,
      kegiatan: "Sholat Subuh Berjamaah",
      status: StatusAbsensi.HADIR,
      dicatatOleh: staffMK.nama,
    },
  });

  await prisma.absensi.create({
    data: {
      santriId: santri2.id,
      kegiatan: "Sholat Subuh Berjamaah",
      status: StatusAbsensi.HADIR,
      dicatatOleh: staffMK.nama,
    },
  });

  await prisma.absensi.create({
    data: {
      santriId: santri3.id,
      kegiatan: "Sholat Subuh Berjamaah",
      status: StatusAbsensi.SAKIT,
      catatan: "Istirahat di UKS",
      dicatatOleh: staffMK.nama,
    },
  });

  console.log("✅ Absensi Kegiatan Pondok berhasil dibuat.");

  // 11. Audit Log Inisialisasi
  await prisma.auditLog.create({
    data: {
      action: "DATABASE_INITIAL_SEED_PHASE_2",
      entity: "SYSTEM",
      details: {
        timestamp: new Date().toISOString(),
        description: "Inisialisasi database STQ Portal Fase 1 & Fase 2",
        totalStaff: 6,
        totalSantri: 4,
        totalMapel: 4,
      },
    },
  });

  console.log("🎉 Seeding database Fase 1 & 2 selesai sempurna!");
}

main()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
