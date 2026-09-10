import {
  PrismaClient,
  Role,
  UserStatus,
  SantriStatus,
  Santri,
  JenisKelamin,
  JenisSetoran,
  NilaiSetoran,
  KategoriMapel,
  JenisNilai,
  JenisIzin,
  StatusIzin,
  StatusAbsensi,
  KategoriCapaian,
  JenisUjiHafalan,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Mulai proses seeding database STQ Portal (Master Data Riil Pesantren)...");

  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  // 1. Bersihkan data lama sesuai urutan relasi foreign key
  await prisma.tasmiSimaan.deleteMany();
  await prisma.capaianBulanan.deleteMany();
  await prisma.targetSantri.deleteMany();
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

  // 2. Buat Staff Master Data (Organisasi Riil STQ Darul Ulum Cendekia)
  const staffKS = await prisma.staff.create({
    data: {
      staffCode: "STF-0001",
      nama: "Ust. Andi Quarzy Ayatullah, S.H, M.H",
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
      nama: "Ust. Razan Mufli, S.Pd",
      noHp: "081234567803",
      roleStaff: Role.MT,
      isKepalaBidangTahfidz: true,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffMK = await prisma.staff.create({
    data: {
      staffCode: "STF-0004",
      nama: "Ust. Mujaddid Zhohruddin",
      noHp: "081234567804",
      roleStaff: Role.MK,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffMTPutri = await prisma.staff.create({
    data: {
      staffCode: "STF-0005",
      nama: "Ustadzah Lisa Dwina Fitri",
      noHp: "081234567805",
      roleStaff: Role.MT,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffPH1 = await prisma.staff.create({
    data: {
      staffCode: "STF-0006",
      nama: "Ust. Kamal",
      noHp: "081234567806",
      roleStaff: Role.PH,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffPH2 = await prisma.staff.create({
    data: {
      staffCode: "STF-0007",
      nama: "Ust. Rizaldi",
      noHp: "081234567807",
      roleStaff: Role.PH,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffPH3 = await prisma.staff.create({
    data: {
      staffCode: "STF-0008",
      nama: "Ust. Abi Hudzaifah",
      noHp: "081234567808",
      roleStaff: Role.PH,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffPH4 = await prisma.staff.create({
    data: {
      staffCode: "STF-0009",
      nama: "Ust. Alwan",
      noHp: "081234567809",
      roleStaff: Role.PH,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const staffGA = await prisma.staff.create({
    data: {
      staffCode: "STF-0010",
      nama: "Ustzh. Nurul Hidayah, S.Pd.",
      noHp: "081234567810",
      roleStaff: Role.GA,
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  console.log("✅ Data master 10 Staff resmi berhasil dibuat.");

  // 3. Buat 6 Kelompok Halaqoh Resmi Pesantren
  const halaqoh1 = await prisma.halaqoh.create({
    data: {
      halaqohCode: "HLQ-0001",
      nama: "Halaqoh Ust. Razan Mufli, S.Pd",
      pembinaId: staffMT1.id,
      tahunAjaran: "2026/2027",
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const halaqoh2 = await prisma.halaqoh.create({
    data: {
      halaqohCode: "HLQ-0002",
      nama: "Halaqoh Ust. Kamal",
      pembinaId: staffPH1.id,
      tahunAjaran: "2026/2027",
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const halaqoh3 = await prisma.halaqoh.create({
    data: {
      halaqohCode: "HLQ-0003",
      nama: "Halaqoh Ust. Rizaldi",
      pembinaId: staffPH2.id,
      tahunAjaran: "2026/2027",
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const halaqoh4 = await prisma.halaqoh.create({
    data: {
      halaqohCode: "HLQ-0004",
      nama: "Halaqoh Ust. Abi Hudzaifah",
      pembinaId: staffPH3.id,
      tahunAjaran: "2026/2027",
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const halaqoh5 = await prisma.halaqoh.create({
    data: {
      halaqohCode: "HLQ-0005",
      nama: "Halaqoh Ust. Alwan",
      pembinaId: staffPH4.id,
      tahunAjaran: "2026/2027",
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  const halaqoh6 = await prisma.halaqoh.create({
    data: {
      halaqohCode: "HLQ-0006",
      nama: "Halaqoh Ustadzah Lisa Dwina Fitri",
      pembinaId: staffMTPutri.id,
      tahunAjaran: "2026/2027",
      status: UserStatus.AKTIF,
      createdBy: "SYSTEM",
    },
  });

  console.log("✅ Data master 6 Halaqoh resmi berhasil dibuat.");

  // 4. Data 57 Santri Riil dari Google Spreadsheet Resmi
  const rawSantriData = [
    // Halaqoh Ust. Razan Mufli, S.Pd (Musyrif Ketahfidzhan) - 5 Santri Putra
    { nis: "SAN-0001", nama: "Obama Ozearld Egberted Turizqi", kelas: "9A", jk: JenisKelamin.L, halaqohId: halaqoh1.id, hblHadits: 78, hblMuf: 250, hblVoc: 250, hblTahfizh: 440 },
    { nis: "SAN-0002", nama: "Muhammad Fardhan", kelas: "9A", jk: JenisKelamin.L, halaqohId: halaqoh1.id, hblHadits: 66, hblMuf: 107, hblVoc: 102, hblTahfizh: 333 },
    { nis: "SAN-0003", nama: "Muh. Fauzan", kelas: "9A", jk: JenisKelamin.L, halaqohId: halaqoh1.id, hblHadits: 100, hblMuf: 250, hblVoc: 250, hblTahfizh: 380 },
    { nis: "SAN-0004", nama: "Khubaib", kelas: "9A", jk: JenisKelamin.L, halaqohId: halaqoh1.id, hblHadits: 100, hblMuf: 250, hblVoc: 250, hblTahfizh: 439 },
    { nis: "SAN-0005", nama: "Abd. Riziq Ardi", kelas: "9A", jk: JenisKelamin.L, halaqohId: halaqoh1.id, hblHadits: 73, hblMuf: 250, hblVoc: 250, hblTahfizh: 435 },

    // Halaqoh Ust. Kamal (Mudhabbir) - 9 Santri Putra
    { nis: "SAN-0006", nama: "Muhammad Amirul Hanif Al-Fatih", kelas: "8A", jk: JenisKelamin.L, halaqohId: halaqoh2.id, hblHadits: 52, hblMuf: 250, hblVoc: 250, hblTahfizh: 252 },
    { nis: "SAN-0007", nama: "Muh. Riski Isral Wijaya", kelas: "8A", jk: JenisKelamin.L, halaqohId: halaqoh2.id, hblHadits: 62, hblMuf: 250, hblVoc: 250, hblTahfizh: 265 },
    { nis: "SAN-0008", nama: "Muhammad Ridwan Kamil", kelas: "8A", jk: JenisKelamin.L, halaqohId: halaqoh2.id, hblHadits: 38, hblMuf: 200, hblVoc: 200, hblTahfizh: 200 },
    { nis: "SAN-0009", nama: "Ahmad Ripai", kelas: "8A", jk: JenisKelamin.L, halaqohId: halaqoh2.id, hblHadits: 29, hblMuf: 120, hblVoc: 120, hblTahfizh: 200 },
    { nis: "SAN-0010", nama: "Muhammad Mikhael", kelas: "8A", jk: JenisKelamin.L, halaqohId: halaqoh2.id, hblHadits: 58, hblMuf: 165, hblVoc: 165, hblTahfizh: 205 },
    { nis: "SAN-0011", nama: "Arya Idris", kelas: "7A", jk: JenisKelamin.L, halaqohId: halaqoh2.id, hblHadits: 32, hblMuf: 118, hblVoc: 118, hblTahfizh: 101 },
    { nis: "SAN-0012", nama: "Muhammad Ghozy Ma'Arif", kelas: "7A", jk: JenisKelamin.L, halaqohId: halaqoh2.id, hblHadits: 33, hblMuf: 135, hblVoc: 135, hblTahfizh: 104 },
    { nis: "SAN-0013", nama: "Muhammad Walied", kelas: "7A", jk: JenisKelamin.L, halaqohId: halaqoh2.id, hblHadits: 39, hblMuf: 158, hblVoc: 158, hblTahfizh: 100 },
    { nis: "SAN-0014", nama: "Hilmy Mutawakkil Al Muntashir", kelas: "8A", jk: JenisKelamin.L, halaqohId: halaqoh2.id, hblHadits: 37, hblMuf: 200, hblVoc: 209, hblTahfizh: 298 },

    // Halaqoh Ust. Rizaldi (Mudhabbir) - 10 Santri Putra
    { nis: "SAN-0015", nama: "Achmad Sufiyan", kelas: "8B", jk: JenisKelamin.L, halaqohId: halaqoh3.id, hblHadits: 33, hblMuf: 113, hblVoc: 113, hblTahfizh: 179 },
    { nis: "SAN-0016", nama: "Muh. Rifki Pria Herman", kelas: "8B", jk: JenisKelamin.L, halaqohId: halaqoh3.id, hblHadits: 28, hblMuf: 109, hblVoc: 109, hblTahfizh: 161 },
    { nis: "SAN-0017", nama: "Muh Fadhlih Aksa", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh3.id, hblHadits: 16, hblMuf: 90, hblVoc: 90, hblTahfizh: 86 },
    { nis: "SAN-0018", nama: "Muhammad Rizky Ashari", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh3.id, hblHadits: 17, hblMuf: 110, hblVoc: 110, hblTahfizh: 100 },
    { nis: "SAN-0019", nama: "Hafidzh Asri", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh3.id, hblHadits: 6, hblMuf: 71, hblVoc: 71, hblTahfizh: 79 },
    { nis: "SAN-0020", nama: "Qonit Su'Adiy", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh3.id, hblHadits: 26, hblMuf: 86, hblVoc: 86, hblTahfizh: 100 },
    { nis: "SAN-0021", nama: "Raja Muddin", kelas: "8B", jk: JenisKelamin.L, halaqohId: halaqoh3.id, hblHadits: 23, hblMuf: 114, hblVoc: 114, hblTahfizh: 134 },
    { nis: "SAN-0022", nama: "M. Alief Pratama", kelas: "8B", jk: JenisKelamin.L, halaqohId: halaqoh3.id, hblHadits: 3, hblMuf: 9, hblVoc: 9, hblTahfizh: 156 },
    { nis: "SAN-0023", nama: "Muh Fadhlan Aksa", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh3.id, hblHadits: 22, hblMuf: 88, hblVoc: 88, hblTahfizh: 100 },
    { nis: "SAN-0024", nama: "Muhammad Azaky", kelas: "9A", jk: JenisKelamin.L, halaqohId: halaqoh3.id, hblHadits: 20, hblMuf: 162, hblVoc: 162, hblTahfizh: 316 },

    // Halaqoh Ust. Abi Hudzaifah (Mudhabbir) - 10 Santri Putra
    { nis: "SAN-0025", nama: "Syahrul Haq", kelas: "7A", jk: JenisKelamin.L, halaqohId: halaqoh4.id, hblHadits: 54, hblMuf: 175, hblVoc: 175, hblTahfizh: 100 },
    { nis: "SAN-0026", nama: "Iksanul Haq", kelas: "7A", jk: JenisKelamin.L, halaqohId: halaqoh4.id, hblHadits: 39, hblMuf: 132, hblVoc: 132, hblTahfizh: 80 },
    { nis: "SAN-0027", nama: "M. Alamsyah", kelas: "7A", jk: JenisKelamin.L, halaqohId: halaqoh4.id, hblHadits: 29, hblMuf: 228, hblVoc: 228, hblTahfizh: 60 },
    { nis: "SAN-0028", nama: "Ahmad Fausan Al Farisi", kelas: "8A", jk: JenisKelamin.L, halaqohId: halaqoh4.id, hblHadits: 28, hblMuf: 138, hblVoc: 60, hblTahfizh: 120 },
    { nis: "SAN-0029", nama: "Abdul Karim", kelas: "7A", jk: JenisKelamin.L, halaqohId: halaqoh4.id, hblHadits: 27, hblMuf: 103, hblVoc: 103, hblTahfizh: 60 },
    { nis: "SAN-0030", nama: "Muhammad Asfa Ilham Ridwan", kelas: "8A", jk: JenisKelamin.L, halaqohId: halaqoh4.id, hblHadits: 28, hblMuf: 155, hblVoc: 155, hblTahfizh: 138 },
    { nis: "SAN-0031", nama: "Khaerul Azam Abu Bakar", kelas: "8A", jk: JenisKelamin.L, halaqohId: halaqoh4.id, hblHadits: 55, hblMuf: 250, hblVoc: 250, hblTahfizh: 136 },
    { nis: "SAN-0032", nama: "Muh. Alif Ihsan", kelas: "8A", jk: JenisKelamin.L, halaqohId: halaqoh4.id, hblHadits: 34, hblMuf: 195, hblVoc: 195, hblTahfizh: 128 },
    { nis: "SAN-0033", nama: "Muh. Imran Maulana Sahid", kelas: "7A", jk: JenisKelamin.L, halaqohId: halaqoh4.id, hblHadits: 34, hblMuf: 168, hblVoc: 168, hblTahfizh: 80 },
    { nis: "SAN-0034", nama: "Affan Garatta", kelas: "9A", jk: JenisKelamin.L, halaqohId: halaqoh4.id, hblHadits: 55, hblMuf: 250, hblVoc: 250, hblTahfizh: 287 },

    // Halaqoh Ust. Alwan (Mudhabbir) - 13 Santri Putra
    { nis: "SAN-0035", nama: "Laode Hisyam Arqana", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 7, hblMuf: 18, hblVoc: 18, hblTahfizh: 67 },
    { nis: "SAN-0036", nama: "Xavier Omar Syarif Hidayatullah", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 27, hblMuf: 121, hblVoc: 121, hblTahfizh: 47 },
    { nis: "SAN-0037", nama: "Muhammad Syafiq", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 22, hblMuf: 73, hblVoc: 73, hblTahfizh: 44 },
    { nis: "SAN-0038", nama: "Andi Muhammad Ghazi Al Fatih", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 30, hblMuf: 127, hblVoc: 127, hblTahfizh: 65 },
    { nis: "SAN-0039", nama: "Zulkifli", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 25, hblMuf: 96, hblVoc: 96, hblTahfizh: 51 },
    { nis: "SAN-0040", nama: "M. Dzul Jalaali Walikhrom Rf", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 23, hblMuf: 125, hblVoc: 125, hblTahfizh: 37 },
    { nis: "SAN-0041", nama: "Abdullah Khairun Nizham", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 28, hblMuf: 116, hblVoc: 116, hblTahfizh: 68 },
    { nis: "SAN-0042", nama: "Andi Muh Rizky S", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 17, hblMuf: 84, hblVoc: 84, hblTahfizh: 31 },
    { nis: "SAN-0043", nama: "Muhammad Rifky Firjatullah", kelas: "8B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 25, hblMuf: 196, hblVoc: 193, hblTahfizh: 100 },
    { nis: "SAN-0044", nama: "Rahmatullah S.", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 19, hblMuf: 71, hblVoc: 71, hblTahfizh: 48 },
    { nis: "SAN-0045", nama: "Ade Naufal", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 90, hblMuf: 104, hblVoc: 104, hblTahfizh: 68 },
    { nis: "SAN-0046", nama: "Hafiz Abd Aziz", kelas: "8B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 37, hblMuf: 95, hblVoc: 116, hblTahfizh: 114 },
    { nis: "SAN-0047", nama: "Badar Fayyadh Nabil", kelas: "7B", jk: JenisKelamin.L, halaqohId: halaqoh5.id, hblHadits: 0, hblMuf: 0, hblVoc: 0, hblTahfizh: 20 },

    // Halaqoh Ustadzah Lisa Dwina Fitri (Musyrifah Putri) - 10 Santriwati Putri
    { nis: "SAN-0048", nama: "Habiba Asri", kelas: "9C", jk: JenisKelamin.P, halaqohId: halaqoh6.id, hblHadits: 60, hblMuf: 325, hblVoc: 325, hblTahfizh: 421 },
    { nis: "SAN-0049", nama: "Meisya Arrahma", kelas: "9C", jk: JenisKelamin.P, halaqohId: halaqoh6.id, hblHadits: 52, hblMuf: 240, hblVoc: 260, hblTahfizh: 335 },
    { nis: "SAN-0050", nama: "Rahmawati", kelas: "8C", jk: JenisKelamin.P, halaqohId: halaqoh6.id, hblHadits: 38, hblMuf: 240, hblVoc: 240, hblTahfizh: 231 },
    { nis: "SAN-0051", nama: "Annisa Az Zahrah A.", kelas: "8C", jk: JenisKelamin.P, halaqohId: halaqoh6.id, hblHadits: 42, hblMuf: 235, hblVoc: 235, hblTahfizh: 237 },
    { nis: "SAN-0052", nama: "Aisyah Muthmainnah", kelas: "8C", jk: JenisKelamin.P, halaqohId: halaqoh6.id, hblHadits: 39, hblMuf: 240, hblVoc: 240, hblTahfizh: 205 },
    { nis: "SAN-0053", nama: "Nur Aqsa", kelas: "7C", jk: JenisKelamin.P, halaqohId: halaqoh6.id, hblHadits: 23, hblMuf: 201, hblVoc: 201, hblTahfizh: 72 },
    { nis: "SAN-0054", nama: "Sri Ramadhaniyanti", kelas: "7C", jk: JenisKelamin.P, halaqohId: halaqoh6.id, hblHadits: 28, hblMuf: 200, hblVoc: 200, hblTahfizh: 55 },
    { nis: "SAN-0055", nama: "Farhana", kelas: "7C", jk: JenisKelamin.P, halaqohId: halaqoh6.id, hblHadits: 14, hblMuf: 71, hblVoc: 71, hblTahfizh: 82 },
    { nis: "SAN-0056", nama: "Rushaifa Rustam", kelas: "7C", jk: JenisKelamin.P, halaqohId: halaqoh6.id, hblHadits: 6, hblMuf: 20, hblVoc: 20, hblTahfizh: 46 },
    { nis: "SAN-0057", nama: "Naafilah Kaltsum Aslan", kelas: "7C", jk: JenisKelamin.P, halaqohId: halaqoh6.id, hblHadits: 13, hblMuf: 55, hblVoc: 60, hblTahfizh: 92 },
  ];

  const createdSantriMap: Record<string, Santri> = {};

  for (const item of rawSantriData) {
    const s = await prisma.santri.create({
      data: {
        nis: item.nis,
        nama: item.nama,
        kelas: item.kelas,
        jenisKelamin: item.jk,
        status: SantriStatus.AKTIF,
        isYatimDhuafa: false,
        namaWali: `Wali ${item.nama.split(" ")[0]}`,
        noHpWali: null,
        halaqohId: item.halaqohId,
        createdBy: "SYSTEM",
      },
    });

    createdSantriMap[item.nis] = s;

    // Inisialisasi TargetSantri Bulan September 2026
    await prisma.targetSantri.createMany({
      data: [
        {
          santriId: s.id,
          jenis: JenisSetoran.SABAQ,
          targetPekanan: 5,
          targetBulanan: 20,
          ambangKepatuhan: 90.0,
          bulan: 9,
          tahunAjaran: "2026/2027",
        },
        {
          santriId: s.id,
          jenis: JenisSetoran.SABQI,
          targetPekanan: 4,
          targetBulanan: 16,
          ambangKepatuhan: 90.0,
          bulan: 9,
          tahunAjaran: "2026/2027",
        },
        {
          santriId: s.id,
          jenis: JenisSetoran.MANZIL,
          targetPekanan: 5,
          targetBulanan: 20,
          ambangKepatuhan: 90.0,
          bulan: 9,
          tahunAjaran: "2026/2027",
        },
        {
          santriId: s.id,
          jenis: JenisSetoran.MUFAR,
          targetPekanan: 5,
          targetBulanan: 20,
          ambangKepatuhan: 90.0,
          bulan: 9,
          tahunAjaran: "2026/2027",
        },
      ],
    });

    // Inisialisasi CapaianBulanan 7 Komponen Mutaba'ah dengan Carry-Over HBL Riil
    await prisma.capaianBulanan.createMany({
      data: [
        {
          santriId: s.id,
          kategori: KategoriCapaian.HAFALAN_HADITS,
          bulan: 9,
          tahunAjaran: "2026/2027",
          hbl: item.hblHadits,
          pekan1: 1,
          pekan2: 1,
          pekan3: 1,
          pekan4: 1,
          total: item.hblHadits + 4,
          targetMin: 4,
          isTuntas: true,
        },
        {
          santriId: s.id,
          kategori: KategoriCapaian.HAFALAN_MUFRODAT,
          bulan: 9,
          tahunAjaran: "2026/2027",
          hbl: item.hblMuf,
          pekan1: 3,
          pekan2: 3,
          pekan3: 3,
          pekan4: 3,
          total: item.hblMuf + 12,
          targetMin: 12,
          isTuntas: true,
        },
        {
          santriId: s.id,
          kategori: KategoriCapaian.HAFALAN_VOCABULARY,
          bulan: 9,
          tahunAjaran: "2026/2027",
          hbl: item.hblVoc,
          pekan1: 3,
          pekan2: 3,
          pekan3: 3,
          pekan4: 3,
          total: item.hblVoc + 12,
          targetMin: 12,
          isTuntas: true,
        },
        {
          santriId: s.id,
          kategori: KategoriCapaian.SHOLAT_TAHAJJUD,
          bulan: 9,
          tahunAjaran: "2026/2027",
          hbl: 0,
          pekan1: 4,
          pekan2: 4,
          pekan3: 4,
          pekan4: 4,
          total: 16,
          targetMin: 15,
          isTuntas: true,
        },
        {
          santriId: s.id,
          kategori: KategoriCapaian.SHOLAT_DHUHA,
          bulan: 9,
          tahunAjaran: "2026/2027",
          hbl: 0,
          pekan1: 4,
          pekan2: 4,
          pekan3: 4,
          pekan4: 4,
          total: 16,
          targetMin: 15,
          isTuntas: true,
        },
        {
          santriId: s.id,
          kategori: KategoriCapaian.PUASA_SUNNAH,
          bulan: 9,
          tahunAjaran: "2026/2027",
          hbl: 0,
          pekan1: 2,
          pekan2: 2,
          pekan3: 1,
          pekan4: 2,
          total: 7,
          targetMin: 6,
          isTuntas: true,
        },
        {
          santriId: s.id,
          kategori: KategoriCapaian.LITERASI,
          bulan: 9,
          tahunAjaran: "2026/2027",
          hbl: 0,
          pekan1: 20,
          pekan2: 25,
          pekan3: 20,
          pekan4: 20,
          total: 85,
          targetMin: 80,
          isTuntas: true,
        },
      ],
    });
  }

  console.log("✅ 57 Data master Santri beserta Target & Mutaba'ah HBL berhasil dibuat.");

  // 5. Buat Akun Pengguna untuk Semua Role & Seluruh Asatidz Mudhabbir
  const santriUtama = createdSantriMap["SAN-0001"];
  const usersData = [
    // Pimpinan & Tata Usaha
    { username: "mudir", email: "mudir@duc-tahfizh.sch.id", role: Role.KS, staffId: staffKS.id },
    { username: "admin", email: "admin@duc-tahfizh.sch.id", role: Role.ADM, staffId: staffADM.id },
    { username: "yayasan", email: "yayasan@duc-tahfizh.sch.id", role: Role.YAY },

    // Musyrif Ketahfidzhan
    { username: "musyrif.tahfizh", email: "musyrif.tahfizh@duc-tahfizh.sch.id", role: Role.MT },
    { username: "razan.mt", email: "razan.tahfizh@duc-tahfizh.sch.id", role: Role.MT, staffId: staffMT1.id },
    { username: "musyrifah.putri", email: "musyrifah@duc-tahfizh.sch.id", role: Role.MT },
    { username: "lisa.mt", email: "lisa.putri@duc-tahfizh.sch.id", role: Role.MT, staffId: staffMTPutri.id },

    // Keasramaan & Organisasi
    { username: "musyrif.asrama", email: "musyrif.asrama@duc-tahfizh.sch.id", role: Role.MK, staffId: staffMK.id },
    { username: "osda", email: "osda@duc-tahfizh.sch.id", role: Role.OSDA },

    // Akademik
    { username: "guru.akademik", email: "guru@duc-tahfizh.sch.id", role: Role.GA, staffId: staffGA.id },

    // 4 Ustadz Mudhabbir (Pembina Halaqoh)
    { username: "pembina.halaqoh", email: "pembina@duc-tahfizh.sch.id", role: Role.PH },
    { username: "kamal.ph", email: "kamal.mudhabbir@duc-tahfizh.sch.id", role: Role.PH, staffId: staffPH1.id },
    { username: "rizaldi.ph", email: "rizaldi.mudhabbir@duc-tahfizh.sch.id", role: Role.PH, staffId: staffPH2.id },
    { username: "hudzaifah.ph", email: "hudzaifah.mudhabbir@duc-tahfizh.sch.id", role: Role.PH, staffId: staffPH3.id },
    { username: "alwan.ph", email: "alwan.mudhabbir@duc-tahfizh.sch.id", role: Role.PH, staffId: staffPH4.id },

    // Wali & Santri
    { username: "walisantri", email: "wali.obama@gmail.com", role: Role.WS },
    { username: "santri.obama", email: "santri.obama@stqduc.sch.id", role: Role.ST, santriId: santriUtama.id },
    { username: "santri.fatih", email: "obama@duc-tahfizh.sch.id", role: Role.ST, santriId: createdSantriMap["SAN-0006"]?.id },
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

  console.log("✅ 11 Akun pengguna resmi berhasil dibuat (Password: 'password123').");

  // 6. Buat Sample Setoran Tahfizh Riil
  await prisma.setoranTahfizh.create({
    data: {
      setoranCode: "SET-000001",
      santriId: santriUtama.id,
      musyrifId: staffMT1.id,
      tanggal: new Date(),
      jenis: JenisSetoran.SABAQ,
      juz: 22,
      halamanMulai: 421,
      halamanSelesai: 421,
      jumlahHalaman: 1,
      nilai: NilaiSetoran.MUMTAZ,
      catatan: "Bacaan sangat tartil, makhrojul huruf dan tajwid sangat fasih.",
      createdBy: staffMT1.staffCode,
    },
  });

  // 7. Buat Log Ujian Tasmi & Simaan Riil (Top Santri)
  await prisma.tasmiSimaan.create({
    data: {
      santriId: santriUtama.id,
      musyrifId: staffMT1.id,
      jenis: JenisUjiHafalan.SIMAAN,
      juz: 22,
      nilai: 91.26,
      predikat: NilaiSetoran.MUMTAZ,
      catatan: "Telah melakukan 2 kali Simaan, 17 Kali Tasmi' (Rata-rata 91.26 - Mumtaz).",
    },
  });

  // 8. Mata Pelajaran Diniyah & Umum
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

  console.log("✅ Mata Pelajaran berhasil dibuat.");

  // 9. Nilai Akademik Santri Utama
  await prisma.nilaiAkademik.create({
    data: {
      santriId: santriUtama.id,
      mapelId: mapelFiqih.id,
      guruId: staffGA.id,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.UTS,
      angka: 95,
      huruf: "A",
      catatan: "Pemahaman thoharoh dan sholat sangat baik.",
    },
  });

  await prisma.nilaiAkademik.create({
    data: {
      santriId: santriUtama.id,
      mapelId: mapelArab.id,
      guruId: staffGA.id,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.UTS,
      angka: 92,
      huruf: "A",
      catatan: "Kaidah nahwu dan insya dipahami dengan lancar.",
    },
  });

  await prisma.nilaiAkademik.create({
    data: {
      santriId: santriUtama.id,
      mapelId: mapelMTK.id,
      guruId: staffGA.id,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.UTS,
      angka: 88,
      huruf: "A",
      catatan: "Teliti dalam menyelesaikan soal logika matematika.",
    },
  });

  await prisma.nilaiAkademik.create({
    data: {
      santriId: santriUtama.id,
      mapelId: mapelAdab.id,
      guruId: staffKS.id,
      semester: 1,
      tahunAjaran: "2026/2027",
      jenis: JenisNilai.KEAKTIFAN,
      angka: 98,
      huruf: "A",
      catatan: "Keteladanan adab terhadap asatidz dan sesama santri sangat istimewa.",
    },
  });

  console.log("✅ Nilai Akademik berhasil dibuat.");

  // 10. Perizinan Santri Berjenjang
  await prisma.perizinanSantri.create({
    data: {
      kodeIzin: "IZN-000001",
      santriId: createdSantriMap["SAN-0003"].id,
      jenis: JenisIzin.SAKIT,
      tanggalMulai: new Date(),
      tanggalSelesai: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      alasan: "Demam dan flu, istirahat di UKS pengawasan klinik pesantren.",
      status: StatusIzin.DISETUJUI,
      disetujuiMKId: staffMK.id,
      catatan: "Telah diperiksa dokter klinik pesantren.",
    },
  });

  await prisma.perizinanSantri.create({
    data: {
      kodeIzin: "IZN-000002",
      santriId: santriUtama.id,
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

  // 11. Absensi Santri
  await prisma.absensi.create({
    data: {
      santriId: santriUtama.id,
      kegiatan: "Sholat Subuh Berjamaah",
      status: StatusAbsensi.HADIR,
      dicatatOleh: staffMK.nama,
    },
  });

  await prisma.absensi.create({
    data: {
      santriId: createdSantriMap["SAN-0002"].id,
      kegiatan: "Sholat Subuh Berjamaah",
      status: StatusAbsensi.HADIR,
      dicatatOleh: staffMK.nama,
    },
  });

  // 12. Audit Log Inisialisasi
  await prisma.auditLog.create({
    data: {
      action: "DATABASE_INITIAL_SEED_REAL_PESANTREN",
      entity: "SYSTEM",
      details: {
        timestamp: new Date().toISOString(),
        description: "Inisialisasi database STQ Portal dengan data riil pesantren dari Google Sheets",
        mudir: "Ust. Andi Quarzy Ayatullah, S.H, M.H",
        musyrifKeasramaan: "Ust. Mujaddid Zhohruddin",
        musyrifKetahfidzhan: "Ust. Razan Mufli, S.Pd",
        musyrifahPutri: "Ustadzah Lisa Dwina Fitri",
        totalStaff: 10,
        totalHalaqoh: 6,
        totalSantri: 57,
      },
    },
  });

  console.log("🎉 Seeding database master data riil pesantren selesai sempurna!");
}

main()
  .catch((e) => {
    console.error("❌ Error saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
