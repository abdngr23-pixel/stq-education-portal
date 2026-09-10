import prisma from "../lib/prisma";
import { getSantriListAction } from "../app/actions/santri";
import { getSantriProgresAction } from "../app/actions/tahfizh";

async function verifyP0E2E() {
  console.log("=================================================================");
  console.log("  VERIFIKASI E2E & PERSISTENSI P0 TAHFIZH STQ DARUL ULUM CENDEKIA ");
  console.log("=================================================================\n");

  // 1. Verifikasi Database Langsung
  console.log("[1] Memeriksa data santri Obama di PostgreSQL...");
  const obama = await prisma.santri.findFirst({
    where: { nis: "SAN-0001" },
    include: {
      setoranList: {
        orderBy: { createdAt: "desc" },
      },
      bintangList: true,
    },
  });

  if (!obama) {
    throw new Error("Obama (SAN-0001) tidak ditemukan!");
  }

  console.log(`   Santri: ${obama.nama} (${obama.nis})`);
  console.log(`   - modalHafalanAwalHalaman (DB): ${obama.modalHafalanAwalHalaman}`);
  console.log(`   - tanggalBaselineTahfizh (DB): ${obama.tanggalBaselineTahfizh?.toISOString()}`);
  
  if (obama.modalHafalanAwalHalaman !== 420) {
    throw new Error(`Expected modal 420, got ${obama.modalHafalanAwalHalaman}`);
  }
  console.log("   ✅ Baseline modal permanen di DB terverifikasi: 420 Halaman.");

  // 2. Verifikasi Status 3 Setoran 582
  console.log("\n[2] Memeriksa status pembatalan 3 setoran halaman 582...");
  const setoran582 = obama.setoranList.filter((s) => s.halamanMulai === 582);
  console.log(`   Ditemukan ${setoran582.length} setoran halaman 582.`);
  for (const s of setoran582) {
    console.log(`   - [${s.setoranCode}] Status: ${s.status} | Dibatalkan Oleh: ${s.dibatalkanBy} | Alasan: ${s.alasanPembatalan}`);
    if (s.status !== "DIBATALKAN") {
      throw new Error(`Setoran ${s.setoranCode} belum berstatus DIBATALKAN!`);
    }
  }
  console.log("   ✅ Seluruh setoran uji coba halaman 582 berstatus DIBATALKAN (soft cancellation).");

  // 3. Verifikasi Server Action getSantriListAction()
  console.log("\n[3] Memeriksa output Server Action getSantriListAction()...");
  const santriListRes = await getSantriListAction();
  if (!santriListRes.success || !santriListRes.data) {
    throw new Error(`getSantriListAction gagal: ${santriListRes.message}`);
  }

  const obamaFromAction = santriListRes.data.find((s) => s.nis === "SAN-0001");
  if (!obamaFromAction) {
    throw new Error("Obama tidak ditemukan dalam output getSantriListAction!");
  }

  console.log("   Output Obama dari getSantriListAction:");
  console.log(`   - modalHafalanAwalHalaman: ${obamaFromAction.modalHafalanAwalHalaman}`);
  console.log(`   - tambahanSabaq: ${obamaFromAction.tambahanSabaq}`);
  console.log(`   - totalHafalan: ${obamaFromAction.totalHafalan}`);
  console.log(`   - posisiTerakhirHalaman: ${obamaFromAction.posisiTerakhirHalaman}`);
  console.log(`   - bintangKebaikan: ${obamaFromAction.bintangKebaikan}`);
  console.log(`   - nilaiTerakhir: ${obamaFromAction.nilaiTerakhir}`);

  if (obamaFromAction.modalHafalanAwalHalaman !== 420) {
    throw new Error(`Server action modal mismatch! Expected 420, got ${obamaFromAction.modalHafalanAwalHalaman}`);
  }
  if (obamaFromAction.tambahanSabaq !== 1) {
    throw new Error(`Server action tambahanSabaq mismatch! Expected 1, got ${obamaFromAction.tambahanSabaq}`);
  }
  if (obamaFromAction.totalHafalan !== 421) {
    throw new Error(`Server action totalHafalan mismatch! Expected 421, got ${obamaFromAction.totalHafalan}`);
  }
  if (obamaFromAction.posisiTerakhirHalaman !== 421) {
    throw new Error(`Server action posisiTerakhir mismatch! Expected 421, got ${obamaFromAction.posisiTerakhirHalaman}`);
  }
  console.log("   ✅ Server Action getSantriListAction() menyajikan 5 metrik terpisah dengan akurat!");

  // 4. Verifikasi Server Action getSantriProgresAction()
  console.log("\n[4] Memeriksa output Server Action getSantriProgresAction()...");
  const progresRes = await getSantriProgresAction(obama.id);
  if (!progresRes.success || !progresRes.data) {
    throw new Error(`getSantriProgresAction gagal: ${progresRes.message}`);
  }

  console.log("   Output Progres Kumulatif:");
  console.log(`   - modalHalamanAwal: ${progresRes.data.modalHalamanAwal}`);
  console.log(`   - tambahanSabaq: ${progresRes.data.tambahanSabaq}`);
  console.log(`   - totalHalamanSabaq: ${progresRes.data.totalHalamanSabaq}`);
  console.log(`   - capaianLabel: ${progresRes.data.capaianLabel}`);

  if (progresRes.data.modalHalamanAwal !== 420 || progresRes.data.totalHalamanSabaq !== 421) {
    throw new Error("Mismatch pada perhitungan getSantriProgresAction!");
  }
  console.log("   ✅ getSantriProgresAction() terverifikasi sinkron dengan baseline DB.");

  // 5. Verifikasi Audit Log Trail
  console.log("\n[5] Memeriksa audit log trail di database...");
  const logs = await prisma.auditLog.findMany({
    where: {
      action: { in: ["UPDATE_BASELINE_MODAL_P0", "BATALKAN_SETORAN_P0"] },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log(`   Ditemukan ${logs.length} audit logs P0:`);
  logs.forEach((l) => console.log(`   - [${l.action}] Entity: ${l.entity} (${l.entityId}) at ${l.createdAt.toISOString()}`));
  if (logs.length < 2) {
    throw new Error("Audit log trail P0 tidak lengkap!");
  }
  console.log("   ✅ Audit log trail tersimpan di PostgreSQL.");

  console.log("\n=================================================================");
  console.log("  SEMUA VERIFIKASI P0 TAHFIZH PERSISTENCE 100% SUKSES!           ");
  console.log("=================================================================");
}

verifyP0E2E()
  .catch((e) => {
    console.error("Gagal verifikasi E2E:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
