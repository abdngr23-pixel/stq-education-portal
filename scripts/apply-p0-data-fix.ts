import prisma from "../lib/prisma";
import { recordAuditLog } from "../lib/auth";

async function main() {
  console.log("=== APPLY P0 TAHFIZH PERSISTENCE DATA FIX ===");

  // 1. Locate Obama
  const obama = await prisma.santri.findFirst({
    where: {
      OR: [
        { nis: "SAN-0001" },
        { nama: { contains: "Obama", mode: "insensitive" } },
      ],
    },
  });

  if (!obama) {
    throw new Error("Santri Obama (SAN-0001) tidak ditemukan di database!");
  }

  console.log(`Santri target: ${obama.nama} (${obama.nis}), ID: ${obama.id}`);
  console.log(`Kondisi: modalHafalanAwalHalaman = ${obama.modalHafalanAwalHalaman}, tanggalBaseline = ${obama.tanggalBaselineTahfizh}`);

  // 2. Update Obama baseline to 420 Halaman, baseline date 2026-09-08
  const baselineDate = new Date("2026-09-08T00:00:00.000Z");
  const updatedObama = await prisma.santri.update({
    where: { id: obama.id },
    data: {
      modalHafalanAwalHalaman: 420,
      tanggalBaselineTahfizh: baselineDate,
    },
  });

  console.log(`\n[SUCCESS] Baseline Obama diperbarui:`);
  console.log(`- modalHafalanAwalHalaman: ${updatedObama.modalHafalanAwalHalaman}`);
  console.log(`- tanggalBaselineTahfizh: ${updatedObama.tanggalBaselineTahfizh?.toISOString()}`);

  // Catat audit log untuk baseline
  await recordAuditLog({
    action: "UPDATE_BASELINE_MODAL_P0",
    entity: "Santri",
    entityId: obama.id,
    details: {
      nis: obama.nis,
      nama: obama.nama,
      modalSebelumnya: obama.modalHafalanAwalHalaman,
      modalBaru: 420,
      tanggalBaseline: baselineDate.toISOString(),
      alasan: "P0: Penetapan modal hafalan awal baseline resmi Obama 420 halaman (21 juz)",
    },
  });

  // 3. Batalkan 3 setoran halaman 582
  const setoran582 = await prisma.setoranTahfizh.findMany({
    where: {
      santriId: obama.id,
      halamanMulai: 582,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nDitemukan ${setoran582.length} setoran halaman 582 untuk Obama:`);
  for (const s of setoran582) {
    console.log(`- ID: ${s.id} | Code: ${s.setoranCode} | Status: ${s.status} | CreatedAt: ${s.createdAt.toISOString()}`);
  }

  const cancelResult = await prisma.setoranTahfizh.updateMany({
    where: {
      santriId: obama.id,
      halamanMulai: 582,
    },
    data: {
      status: "DIBATALKAN",
      alasanPembatalan: "P0 Audit: Pembatalan data setoran uji coba/duplikasi halaman 582",
      dibatalkanAt: new Date(),
      dibatalkanBy: "SYSTEM_P0_AUDIT",
    },
  });

  console.log(`\n[SUCCESS] Berhasil membatalkan ${cancelResult.count} setoran halaman 582 (soft cancellation, status = DIBATALKAN).`);

  // Catat audit log untuk pembatalan setoran
  for (const s of setoran582) {
    await recordAuditLog({
      action: "BATALKAN_SETORAN_P0",
      entity: "SetoranTahfizh",
      entityId: s.id,
      details: {
        setoranCode: s.setoranCode,
        santriId: obama.id,
        halamanMulai: s.halamanMulai,
        halamanSelesai: s.halamanSelesai,
        jumlahHalaman: s.jumlahHalaman,
        alasan: "P0 Audit: Pembatalan data setoran uji coba/duplikasi halaman 582",
      },
    });
  }

  // 4. Verifikasi rekap capaian Obama saat ini
  console.log("\n=== VERIFIKASI AKUMULASI CAPAIAN OBAMA ===");
  const validSetoran = await prisma.setoranTahfizh.findMany({
    where: {
      santriId: obama.id,
      status: { not: "DIBATALKAN" },
      jenis: "SABAQ",
      createdAt: {
        gte: baselineDate,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const tambahanSabaq = validSetoran.reduce((acc, curr) => acc + (curr.jumlahHalaman || 0), 0);
  const totalHafalan = (updatedObama.modalHafalanAwalHalaman || 0) + tambahanSabaq;

  // Cari posisi halaman terakhir dari seluruh setoran valid
  const lastSetoran = await prisma.setoranTahfizh.findFirst({
    where: {
      santriId: obama.id,
      status: { not: "DIBATALKAN" },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`- Modal Hafalan Awal: ${updatedObama.modalHafalanAwalHalaman} Halaman`);
  console.log(`- Tanggal Baseline: ${updatedObama.tanggalBaselineTahfizh?.toISOString()}`);
  console.log(`- Setoran Sabaq Valid Sejak Baseline: ${validSetoran.length} record`);
  validSetoran.forEach((s) => {
    console.log(`  * ${s.setoranCode}: Hlm ${s.halamanMulai}–${s.halamanSelesai} (${s.jumlahHalaman} hlm) - ${s.createdAt.toISOString()}`);
  });
  console.log(`- Tambahan Sabaq: ${tambahanSabaq} Halaman`);
  console.log(`- Total Hafalan Saat Ini (Modal + Sabaq): ${totalHafalan} Halaman`);
  console.log(`- Posisi Terakhir Mushaf: Hlm ${lastSetoran ? `${lastSetoran.halamanSelesai}` : updatedObama.modalHafalanAwalHalaman}`);
  console.log(`- Target Akhir 30 Juz: 604 Halaman`);
  console.log(`- Sisa Menuju 30 Juz: ${604 - totalHafalan} Halaman`);

  console.log("\n=== DATA FIX SELESAI DENGAN SUKSES ===");
}

main()
  .catch((e) => {
    console.error("Error running script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
