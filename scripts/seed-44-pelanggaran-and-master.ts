import { PrismaClient, TingkatPelanggaran, KategoriMapel } from '@prisma/client';

const prisma = new PrismaClient();

export const MASTER_44_PELANGGARAN = [
  // KATEGORI 1 — HUKUMAN LANGSUNG
  {
    kode: "PLG-KAT1-01",
    nama: "Main main dalam sholat",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Pukul kaki dengan menggunakan rotan 3x",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-02",
    nama: "Mengganggu teman yang sedang sholat",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Pukul kaki dengan menggunakan rotan 3x",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-03",
    nama: "Merusak fasilitas keasramaan",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Ganti rugi dan pukul tangan dengan rotan 3x",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-04",
    nama: "Menyontek Saat Ujian",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Robek Kertas Jawaban + Pengurangan Nilai",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-05",
    nama: "Terlambat Datang Kepondok",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Bawa Semen 1 Sak per hari",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-06",
    nama: "Berbohong",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Sentil mulut 3x",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-07",
    nama: "Bicara kotor",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Jalan jongkok 2x keliling plus sentil mulut 3x",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-08",
    nama: "Bicara kasar",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Jalan jongkok 1x keliling plus sentil mulut 1x",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-09",
    nama: "Berkelahi/bertengkar",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Berdiri Diatas Kursi 20 Menit",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-10",
    nama: "Membully Verbal",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Sentil mulut 3x + meminta Maaf",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-11",
    nama: "Pemalsuan Tanda Tangan/Formalitas",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Jalan jongkok 1 putaran dengan bambu + Pukul tangan dengan rotan 3x",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT1-12",
    nama: "Pemalakan",
    tingkat: TingkatPelanggaran.KATEGORI_1,
    sanksi: "Jalan jongkok 1 putaran dengan bambu + Pukul tangan dengan rotan 3x",
    poinDasar: null,
  },

  // KATEGORI 2 — PEMBERIAN POINT
  {
    kode: "PLG-KAT2-13",
    nama: "Terlambat masuk masjid",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Push up 15 kali",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-14",
    nama: "Bermain-main atau tidur saat wirid",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Berdiri di depan hingga wirid selesai",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-15",
    nama: "Membuang sampah sembarangan",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Memungut sampah di seluruh area",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-16",
    nama: "Tidak membersihkan",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Push up 10 kali + Membersihkan sendirian",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-17",
    nama: "Tidak mencuci alat makan/rantang",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Sit up 10 kali",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-18",
    nama: "Tidak merapikan sandal",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Dipukul menggunakan sendalnya",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-19",
    nama: "Tidak memakai sandal",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Angkat kaki selama 5 menit",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-20",
    nama: "Tidak merapikan barang pribadi",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Plank selama 6 menit",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-21",
    nama: "Tidak mengembalikan barang pada tempatnya",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Push up 10 kali",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-22",
    nama: "Tidak mematikan alat elektronik di kamar",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Jalan jongkok mengelilingi kamar 1 kali",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-23",
    nama: "Tidak istirahat pada waktu yang telah ditentukan",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Jalan jongkok 1 putaran",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-24",
    nama: "Terlambat masuk kelas",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Push up 15 kali",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-25",
    nama: "Tidak melaporkan saat kedatangan",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Push up 15 kali",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-26",
    nama: "Tidak menjalankan tugas dengan maksimal",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Skot jam 15 kali",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-27",
    nama: "Memakai barang orang lain tanpa izin",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Skot jam 25 kali + Push up 10 kali",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT2-28",
    nama: "Terlambat sholat (masbuk)",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 4,
  },
  {
    kode: "PLG-KAT2-29",
    nama: "Tidak melaksanakan sholat sunnah yang ditetapkan pondok",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 2,
  },
  {
    kode: "PLG-KAT2-30",
    nama: "Tidak melaksanakan sholat berjamaah",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 5,
  },
  {
    kode: "PLG-KAT2-31",
    nama: "Wali santri Datang bukan waktu penjengukan",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 5,
  },
  {
    kode: "PLG-KAT2-32",
    nama: "Tidak mengikuti program wajib",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 4,
  },
  {
    kode: "PLG-KAT2-33",
    nama: "Tidak mengenakan seragam program yang telah ditentukan",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 2,
  },
  {
    kode: "PLG-KAT2-34",
    nama: "Tidak Mengumpulkan Uang",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Denda 10% Untuk Kas Pondok",
    poinDasar: 5,
  },
  {
    kode: "PLG-KAT2-35",
    nama: "Tidak mandi dan tidak menggosok gigi",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 2,
  },
  {
    kode: "PLG-KAT2-36",
    nama: "Tidak melaksanakan tugas piket",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 3,
  },
  {
    kode: "PLG-KAT2-37",
    nama: "Membantah atau tidak menghormati perintah yang sah",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 5,
  },
  {
    kode: "PLG-KAT2-38",
    nama: "Tidur di tempat tidur milik orang lain tanpa izin",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 3,
  },
  {
    kode: "PLG-KAT2-39",
    nama: "Keluar dari area pondok tanpa izin",
    tingkat: TingkatPelanggaran.KATEGORI_2,
    sanksi: "Poin pelanggaran",
    poinDasar: 2,
  },

  // KATEGORI 3 — POINT + HUKUMAN SOSIAL
  {
    kode: "PLG-KAT3-40",
    nama: "Mencuri",
    tingkat: TingkatPelanggaran.KATEGORI_3,
    sanksi: "Pukul tangan dengan rotan 5x + SP 1/SP 2/SP 3",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT3-41",
    nama: "Pacaran",
    tingkat: TingkatPelanggaran.KATEGORI_3,
    sanksi: "Belum ditentukan",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT3-42",
    nama: "Menonton, Melihat atau Menulis hal hal yang tidak pantas",
    tingkat: TingkatPelanggaran.KATEGORI_3,
    sanksi: "Pukul tangan dengan rotan 5x + SP 1/SP 2/SP 3",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT3-43",
    nama: "Merokok dan sejenisnya",
    tingkat: TingkatPelanggaran.KATEGORI_3,
    sanksi: "Pukul tangan dengan rotan 5x + SP 1/SP 2/SP 3",
    poinDasar: null,
  },
  {
    kode: "PLG-KAT3-44",
    nama: "Membully Fisik",
    tingkat: TingkatPelanggaran.KATEGORI_3,
    sanksi: "SP 1",
    poinDasar: null,
  },
];

export const MASTER_KEPESANTRENAN_MAPEL = [
  { kodeMapel: "KPS-ARB", nama: "Bahasa Arab", kategori: KategoriMapel.KEPESANTRENAN },
  { kodeMapel: "KPS-FQH", nama: "Fikih", kategori: KategoriMapel.KEPESANTRENAN },
  { kodeMapel: "KPS-TFS", nama: "Tafsir", kategori: KategoriMapel.KEPESANTRENAN },
  { kodeMapel: "KPS-TJW", nama: "Tajwid", kategori: KategoriMapel.KEPESANTRENAN },
  { kodeMapel: "KPS-AQD", nama: "Aqidah Islamiyah", kategori: KategoriMapel.KEPESANTRENAN },
];

async function main() {
  console.log("🚀 Menjalankan seeding 44 Master Pelanggaran, Kepesantrenan, Kebijakan, dan Backfill 30 Juz...");

  // 1. Seed / Upsert 44 Pelanggaran
  console.log("⚖ [1/4] Mengisi 44 Master Data Pelanggaran...");
  for (const item of MASTER_44_PELANGGARAN) {
    await prisma.kategoriPelanggaran.upsert({
      where: { kode: item.kode },
      update: {
        nama: item.nama,
        tingkat: item.tingkat,
        poinDasar: item.poinDasar,
        sanksi: item.sanksi,
      },
      create: {
        kode: item.kode,
        nama: item.nama,
        tingkat: item.tingkat,
        poinDasar: item.poinDasar,
        sanksi: item.sanksi,
      },
    });
  }
  const countPelanggaran = await prisma.kategoriPelanggaran.count();
  console.log(`✔ Berhasil: ${countPelanggaran} master kategori pelanggaran tercatat di database.`);

  // 2. Seed 5 Mata Pelajaran Kepesantrenan
  console.log("📚 [2/4] Mengisi 5 Materi Kepesantrenan Resmi...");
  for (const mapel of MASTER_KEPESANTRENAN_MAPEL) {
    await prisma.mataPelajaran.upsert({
      where: { kodeMapel: mapel.kodeMapel },
      update: {
        nama: mapel.nama,
        kategori: mapel.kategori,
      },
      create: {
        kodeMapel: mapel.kodeMapel,
        nama: mapel.nama,
        kategori: mapel.kategori,
      },
    });
  }
  console.log("✔ Berhasil: 5 Materi Kepesantrenan terdaftar.");

  // 3. Kebijakan Reward & Sanksi Default
  console.log("🏆 [3/4] Memeriksa Kebijakan Reward & Sanksi...");
  const existingKebijakan = await prisma.kebijakanRewardSanksi.findFirst();
  if (!existingKebijakan) {
    await prisma.kebijakanRewardSanksi.create({
      data: {
        nama: "Kebijakan Standar Pesantren STQ DUC",
        minNilaiTasmi: 80.0,
        minNilaiSimaan: 85.0,
        bintangTasmi: 1,
        bintangSimaan: 2,
        hakLiburTasmiHari: 1,
        hakLiburSimaanHari: 2,
        minPersenTargetBulanan: 100.0,
        durasiKehilanganKunjunganHari: 30,
        isActive: true,
        createdBy: "SYSTEM",
      },
    });
    console.log("✔ Berhasil: Kebijakan Reward & Sanksi awal dibuat.");
  } else {
    console.log("✔ Kebijakan Reward & Sanksi sudah aktif.");
  }

  // 4. Backfill Santri targetAkhirProgramJuz = 30
  console.log("🎯 [4/4] Memastikan seluruh santri memiliki targetAkhirProgramJuz = 30...");
  const updateRes = await prisma.santri.updateMany({
    where: {
      targetAkhirProgramJuz: { not: 30 },
    },
    data: {
      targetAkhirProgramJuz: 30,
    },
  });
  console.log(`✔ Berhasil: ${updateRes.count} santri diperbarui ke target akhir 30 Juz.`);

  console.log("✨ SELESAI SEMPURNA!");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ Error seeding master data:", e);
  await prisma.$disconnect();
  process.exit(1);
});
