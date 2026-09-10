import prisma from "../lib/prisma";

async function main() {
  console.log("=== AUDIT SETORAN TAHFIZH (READ-ONLY) ===");
  
  const setorans = await prisma.setoranTahfizh.findMany({
    include: {
      santri: {
        select: {
          id: true,
          nis: true,
          nama: true,
          kelas: true,
        },
      },
      musyrif: {
        select: {
          id: true,
          nama: true,
          staffCode: true,
        },
      },
    },
    orderBy: [
      { santriId: "asc" },
      { createdAt: "asc" },
    ],
  });

  console.log(`Total setoran ditemukan: ${setorans.length}`);
  
  interface AuditSetoranRow {
    id: string;
    setoranCode: string;
    santriNama: string;
    santriNis: string;
    jenis: string;
    juz: number;
    halaman: string;
    jumlahHalaman: number;
    nilai: string;
    waktuCreatedAt: string;
    tanggalOperasional: string;
    pencatat: string;
    selisihWaktuDetikDenganSebelumnya: number | null;
    kemungkinanDuplikat: boolean;
    catatan: string | null;
  }

  const auditRows: AuditSetoranRow[] = [];

  for (let i = 0; i < setorans.length; i++) {
    const curr = setorans[i];
    const prev = i > 0 ? setorans[i - 1] : null;

    let selisihDetik: number | null = null;
    let isDuplikat = false;

    if (prev && prev.santriId === curr.santriId) {
      const diffMs = curr.createdAt.getTime() - prev.createdAt.getTime();
      selisihDetik = Math.round(diffMs / 1000);

      // Kriteria duplikat: santri sama, jenis sama, halaman sama, jumlah sama, nilai sama, dan waktu < 300 detik (5 menit)
      if (
        prev.jenis === curr.jenis &&
        prev.juz === curr.juz &&
        prev.halamanMulai === curr.halamanMulai &&
        prev.halamanSelesai === curr.halamanSelesai &&
        prev.jumlahHalaman === curr.jumlahHalaman &&
        prev.nilai === curr.nilai &&
        selisihDetik <= 300
      ) {
        isDuplikat = true;
      }
    }

    auditRows.push({
      id: curr.id,
      setoranCode: curr.setoranCode,
      santriNama: curr.santri.nama,
      santriNis: curr.santri.nis,
      jenis: curr.jenis,
      juz: curr.juz,
      halaman: `Hlm ${curr.halamanMulai}–${curr.halamanSelesai}`,
      jumlahHalaman: curr.jumlahHalaman,
      nilai: curr.nilai,
      waktuCreatedAt: curr.createdAt.toISOString(),
      tanggalOperasional: curr.tanggal.toISOString().split("T")[0],
      pencatat: curr.musyrif.nama,
      selisihWaktuDetikDenganSebelumnya: selisihDetik,
      kemungkinanDuplikat: isDuplikat,
      catatan: curr.catatan,
    });
  }

  console.table(auditRows);

  console.log("\n=== RINGKASAN REKOMENDASI KEMUNGKINAN DUPLIKAT ===");
  const duplikatList = auditRows.filter((r) => r.kemungkinanDuplikat);
  if (duplikatList.length === 0) {
    console.log("Tidak ada setoran yang terindikasi duplikat cepat.");
  } else {
    console.log(`Ditemukan ${duplikatList.length} record berindikasi kuat sebagai duplikat submit:`);
    duplikatList.forEach((d, idx) => {
      console.log(
        `${idx + 1}. ID: ${d.id} | Kode: ${d.setoranCode} | Santri: ${d.santriNama} (${d.santriNis}) | ${d.halaman} | Selisih: ${d.selisihWaktuDetikDenganSebelumnya}s | Status: Kemungkinan Duplikat`
      );
    });
  }
}

main()
  .catch((e) => {
    console.error("Gagal menjalankan audit setoran duplikat:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
