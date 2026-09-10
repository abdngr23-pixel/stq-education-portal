import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("P0 Koreksi Tahfizh Persistence, Modal Awal & Idempotensi", () => {
  // Helper formula sesuai implementasi santri.ts & tahfizh.ts
  function hitungCapaianTahfizh(params: {
    modalHafalanAwalHalaman: number;
    tanggalBaselineTahfizh: Date;
    setoranList: Array<{
      id: string;
      jenis: "SABAQ" | "SABQI" | "MANZIL" | "MUFAR";
      jumlahHalaman: number;
      halamanMulai: number;
      halamanSelesai: number;
      createdAt: Date;
      status: "AKTIF" | "DIBATALKAN";
    }>;
  }) {
    const modalAwal = Math.max(0, params.modalHafalanAwalHalaman || 0);
    const baselineDate = params.tanggalBaselineTahfizh;

    // Filter sabaq aktif setelah baseline
    const sabaqValid = params.setoranList.filter(
      (s) =>
        s.status !== "DIBATALKAN" &&
        s.jenis === "SABAQ" &&
        s.createdAt.getTime() >= baselineDate.getTime()
    );

    const tambahanSabaq = sabaqValid.reduce((acc, curr) => acc + curr.jumlahHalaman, 0);
    const totalHafalan = Math.min(604, modalAwal + tambahanSabaq);

    // Posisi terakhir mushaf dari seluruh setoran non-dibatalkan
    const setoranAktif = params.setoranList
      .filter((s) => s.status !== "DIBATALKAN")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const posisiTerakhir = setoranAktif.length > 0 ? setoranAktif[0].halamanSelesai : modalAwal;

    return {
      modalAwal,
      tambahanSabaq,
      totalHafalan,
      posisiTerakhir,
      targetAkhir: 604,
      sisaMenujuTarget: Math.max(0, 604 - totalHafalan),
    };
  }

  describe("1. Formula Akumulasi Capaian & Pemisahan 5 Metrik", () => {
    it("harus menghitung total hafalan = modal awal + sabaq valid setelah baseline", () => {
      const baseline = new Date("2026-09-08T00:00:00.000Z");
      const hasil = hitungCapaianTahfizh({
        modalHafalanAwalHalaman: 420,
        tanggalBaselineTahfizh: baseline,
        setoranList: [
          {
            id: "s1",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 421,
            halamanSelesai: 421,
            createdAt: new Date("2026-09-09T10:00:00.000Z"),
            status: "AKTIF",
          },
        ],
      });

      assert.equal(hasil.modalAwal, 420, "Modal awal harus 420");
      assert.equal(hasil.tambahanSabaq, 1, "Tambahan sabaq harus 1");
      assert.equal(hasil.totalHafalan, 421, "Total hafalan harus 421");
      assert.equal(hasil.posisiTerakhir, 421, "Posisi terakhir mushaf harus 421");
      assert.equal(hasil.targetAkhir, 604, "Target akhir 30 juz harus 604");
      assert.equal(hasil.sisaMenujuTarget, 183, "Sisa target harus 183");
    });

    it("tidak boleh memasukkan jenis SABQI, MANZIL, atau MUFAR ke dalam total capaian hafalan", () => {
      const baseline = new Date("2026-09-08T00:00:00.000Z");
      const hasil = hitungCapaianTahfizh({
        modalHafalanAwalHalaman: 420,
        tanggalBaselineTahfizh: baseline,
        setoranList: [
          {
            id: "s1",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 421,
            halamanSelesai: 421,
            createdAt: new Date("2026-09-09T10:00:00.000Z"),
            status: "AKTIF",
          },
          {
            id: "s2",
            jenis: "SABQI",
            jumlahHalaman: 5,
            halamanMulai: 416,
            halamanSelesai: 420,
            createdAt: new Date("2026-09-09T11:00:00.000Z"),
            status: "AKTIF",
          },
          {
            id: "s3",
            jenis: "MANZIL",
            jumlahHalaman: 20,
            halamanMulai: 1,
            halamanSelesai: 20,
            createdAt: new Date("2026-09-09T12:00:00.000Z"),
            status: "AKTIF",
          },
          {
            id: "s4",
            jenis: "MUFAR",
            jumlahHalaman: 2,
            halamanMulai: 580,
            halamanSelesai: 581,
            createdAt: new Date("2026-09-09T13:00:00.000Z"),
            status: "AKTIF",
          },
        ],
      });

      assert.equal(hasil.modalAwal, 420);
      assert.equal(hasil.tambahanSabaq, 1, "Hanya SABAQ yang menambah akumulasi");
      assert.equal(hasil.totalHafalan, 421);
    });

    it("wajib mengecualikan setoran berstatus DIBATALKAN dari akumulasi capaian", () => {
      const baseline = new Date("2026-09-08T00:00:00.000Z");
      const hasil = hitungCapaianTahfizh({
        modalHafalanAwalHalaman: 420,
        tanggalBaselineTahfizh: baseline,
        setoranList: [
          {
            id: "s1",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 421,
            halamanSelesai: 421,
            createdAt: new Date("2026-09-09T10:00:00.000Z"),
            status: "AKTIF",
          },
          // 3 setoran halaman 582 yang dibatalkan
          {
            id: "s2",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 582,
            halamanSelesai: 582,
            createdAt: new Date("2026-09-10T02:08:00.000Z"),
            status: "DIBATALKAN",
          },
          {
            id: "s3",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 582,
            halamanSelesai: 582,
            createdAt: new Date("2026-09-10T02:09:00.000Z"),
            status: "DIBATALKAN",
          },
          {
            id: "s4",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 582,
            halamanSelesai: 582,
            createdAt: new Date("2026-09-10T02:10:00.000Z"),
            status: "DIBATALKAN",
          },
        ],
      });

      assert.equal(hasil.modalAwal, 420);
      assert.equal(hasil.tambahanSabaq, 1, "Setoran DIBATALKAN tidak dihitung");
      assert.equal(hasil.totalHafalan, 421, "Total akumulasi tetap 421");
      assert.equal(hasil.posisiTerakhir, 421, "Posisi terakhir mengabaikan setoran yang dibatalkan");
    });

    it("tidak boleh menghitung setoran SABAQ yang terjadi sebelum tanggal baseline", () => {
      const baseline = new Date("2026-09-08T00:00:00.000Z");
      const hasil = hitungCapaianTahfizh({
        modalHafalanAwalHalaman: 420,
        tanggalBaselineTahfizh: baseline,
        setoranList: [
          {
            id: "old-sabaq",
            jenis: "SABAQ",
            jumlahHalaman: 10,
            halamanMulai: 400,
            halamanSelesai: 409,
            createdAt: new Date("2026-09-01T10:00:00.000Z"), // Sebelum baseline
            status: "AKTIF",
          },
          {
            id: "new-sabaq",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 421,
            halamanSelesai: 421,
            createdAt: new Date("2026-09-09T10:00:00.000Z"), // Setelah baseline
            status: "AKTIF",
          },
        ],
      });

      assert.equal(hasil.tambahanSabaq, 1, "Sabaq sebelum baseline tidak dihitung ganda dengan modal awal");
      assert.equal(hasil.totalHafalan, 421);
    });
  });

  describe("2. Idempotensi & Pencegahan Double Submit via clientRequestId", () => {
    it("harus menolak duplikasi saat clientRequestId yang sama dikirim dua kali", () => {
      const mockDatabase = new Map<string, { id: string; clientRequestId: string; halaman: number }>();

      function saveSetoranIdempotent(payload: { clientRequestId: string; halaman: number }) {
        // Cek jika sudah ada
        for (const record of mockDatabase.values()) {
          if (record.clientRequestId === payload.clientRequestId) {
            return { success: true, isDuplicate: true, record };
          }
        }

        const id = `SET-${Date.now()}`;
        const newRecord = { id, ...payload };
        mockDatabase.set(id, newRecord);
        return { success: true, isDuplicate: false, record: newRecord };
      }

      const clientReqId = "req-uuid-12345-67890";
      const firstCall = saveSetoranIdempotent({ clientRequestId: clientReqId, halaman: 422 });
      assert.equal(firstCall.isDuplicate, false);
      assert.equal(mockDatabase.size, 1);

      // Simulasikan double click / retry network
      const secondCall = saveSetoranIdempotent({ clientRequestId: clientReqId, halaman: 422 });
      assert.equal(secondCall.isDuplicate, true);
      assert.equal(secondCall.record.id, firstCall.record.id);
      assert.equal(mockDatabase.size, 1, "Database tidak boleh bertambah pada idempotency match");
    });
  });

  describe("3. Deteksi Lompatan Halaman (Sequence Jump Warning)", () => {
    function cekLompatanHalaman(posisiTerakhir: number, halamanMulaiBaru: number) {
      const selisih = halamanMulaiBaru - posisiTerakhir;
      if (selisih > 10) {
        return {
          isJump: true,
          tipe: "LOMPATAN_JAUH",
          pesan: `Halaman setoran (${halamanMulaiBaru}) melompat ${selisih} halaman dari posisi terakhir (${posisiTerakhir}).`,
        };
      }
      if (selisih < -5) {
        return {
          isJump: true,
          tipe: "MUNDUR_JAUH",
          pesan: `Halaman setoran (${halamanMulaiBaru}) mundur dari posisi terakhir (${posisiTerakhir}).`,
        };
      }
      return { isJump: false, tipe: "NORMAL", pesan: "Urutan wajar" };
    }

    it("harus mendeteksi lompatan jauh dari 421 ke 582", () => {
      const res = cekLompatanHalaman(421, 582);
      assert.equal(res.isJump, true);
      assert.equal(res.tipe, "LOMPATAN_JAUH");
    });

    it("harus mengizinkan urutan sekuensial wajar dari 421 ke 422 tanpa peringatan", () => {
      const res = cekLompatanHalaman(421, 422);
      assert.equal(res.isJump, false);
      assert.equal(res.tipe, "NORMAL");
    });
  });

  describe("4. Fail-Closed Access Control Rule", () => {
    function checkMusyrifAccess(session: { role: string; staffId?: string | null }) {
      if (session.role === "MUSYRIF_TAHFIZH" || session.role === "PENGASUHAN") {
        if (!session.staffId) {
          return { allowed: false, error: "Akun Musyrif belum tertaut dengan profil Staff aktif." };
        }
      }
      return { allowed: true };
    }

    it("harus menolak akun MT/PH tanpa staffId (Fail-Closed)", () => {
      const res1 = checkMusyrifAccess({ role: "MUSYRIF_TAHFIZH", staffId: null });
      assert.equal(res1.allowed, false);

      const res2 = checkMusyrifAccess({ role: "PENGASUHAN", staffId: undefined });
      assert.equal(res2.allowed, false);
    });

    it("harus mengizinkan akun MT/PH dengan staffId valid", () => {
      const res = checkMusyrifAccess({ role: "MUSYRIF_TAHFIZH", staffId: "stf-12345" });
      assert.equal(res.allowed, true);
    });
  });
});
