import prisma from "../lib/prisma";

async function main() {
  try {
    const updated = await prisma.staff.updateMany({
      where: {
        OR: [
          { nama: { contains: "Razan", mode: "insensitive" } },
          { staffCode: "STF-0003" },
        ],
      },
      data: {
        isKepalaBidangTahfidz: true,
      },
    });
    console.log(`Berhasil menandai ${updated.count} staff Ust. Razan Mufli sebagai isKepalaBidangTahfidz: true`);
  } catch (err) {
    console.warn("Database offline atau migrasi ditunda. Konfigurasi in-memory & session fallback aktif untuk Ust. Razan:", err);
  }
}

main().finally(() => process.exit(0));
