import prisma from "../lib/prisma";

async function main() {
  const [santriCount, staffCount, halaqohCount, setoranCount, pelanggaranCount] = await Promise.all([
    prisma.santri.count(),
    prisma.staff.count(),
    prisma.halaqoh.count(),
    prisma.setoranTahfizh.count(),
    prisma.pelanggaranSantri.count(),
  ]);

  console.log("=== JUMLAH DATA DALAM DATABASE REAL ===");
  console.log({
    santri: santriCount,
    staff: staffCount,
    halaqoh: halaqohCount,
    setoranTahfizh: setoranCount,
    pelanggaranSantri: pelanggaranCount,
  });

  const sampleSantri = await prisma.santri.findMany({
    take: 3,
    select: { id: true, nis: true, nama: true, halaqohId: true },
  });
  console.log("Sample Real Santri IDs in PostgreSQL:", sampleSantri);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
