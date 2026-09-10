import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("P0 Lanjutan: Posisi Otomatis, Filter Sabaq Sah, & Validasi Tahfizh", () => {
  // Helper formula penghitungan posisi dan saran SABAQ sesuai implementasi di santri.ts & tahfizh-module.tsx
  function hitungPosisiDanSaranSabaq(params: {
    modalHalamanAwal: number;
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
    const modalAwal = Math.max(0, params.modalHalamanAwal || 0);
    const baselineDate = params.tanggalBaselineTahfizh;

    // Filter sabaq aktif sah setelah baseline
    const sabaqAktifPostBaseline = params.setoranList
      .filter(
        (s) =>
          s.status !== "DIBATALKAN" &&
          s.jenis === "SABAQ" &&
          s.createdAt.getTime() >= baselineDate.getTime()
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let posisiTerakhirHalaman = modalAwal;
    let isHalamanTerakhirParsial = false;

    if (sabaqAktifPostBaseline.length > 0) {
      const latestSabaq = sabaqAktifPostBaseline[0];
      posisiTerakhirHalaman = latestSabaq.halamanSelesai;

      // Periksa total volume setoran SABAQ aktif pada halaman terakhir tersebut
      const totalVolumeHalamanTerakhir = sabaqAktifPostBaseline
        .filter((s) => s.halamanSelesai === posisiTerakhirHalaman)
        .reduce((sum, s) => sum + s.jumlahHalaman, 0);

      if (totalVolumeHalamanTerakhir < 1.0) {
        isHalamanTerakhirParsial = true;
      }
    }

    // Penerapan saran halaman mulai sesuai fungsi applySuggestedSabaqPosition
    let saranHalamanMulai: number;
    let saranJumlahHalaman: number;

    if (isHalamanTerakhirParsial && posisiTerakhirHalaman > 0) {
      saranHalamanMulai = posisiTerakhirHalaman;
      saranJumlahHalaman = 0.5;
    } else if (posisiTerakhirHalaman >= 604) {
      saranHalamanMulai = 604;
      saranJumlahHalaman = 1;
    } else if (posisiTerakhirHalaman === 0) {
      saranHalamanMulai = 1;
      saranJumlahHalaman = 1;
    } else {
      saranHalamanMulai = Math.min(604, posisiTerakhirHalaman + 1);
      saranJumlahHalaman = 1;
    }

    const saranHalamanSelesai =
      saranJumlahHalaman === 0.5
        ? saranHalamanMulai
        : saranHalamanMulai + Math.ceil(saranJumlahHalaman) - 1;

    return {
      posisiTerakhirHalaman,
      isHalamanTerakhirParsial,
      saranHalamanMulai,
      saranJumlahHalaman,
      saranHalamanSelesai,
    };
  }

  // Helper validasi kapasitas halaman 1.0 di server (tahfizh.ts)
  function validasiKapasitasHalamanSabaq(params: {
    targetHalaman: number;
    jumlahHalamanBaru: number;
    existingSetoranSabaq: Array<{
      halamanMulai: number;
      halamanSelesai: number;
      jumlahHalaman: number;
      status: "AKTIF" | "DIBATALKAN";
    }>;
  }) {
    const existingVolume = params.existingSetoranSabaq
      .filter((s) => s.status !== "DIBATALKAN" && s.halamanMulai === params.targetHalaman)
      .reduce((sum, s) => sum + s.jumlahHalaman, 0);

    if (existingVolume + params.jumlahHalamanBaru > 1.0) {
      return {
        valid: false,
        message: `Halaman ${params.targetHalaman} sudah terakumulasi ${existingVolume} halaman. Total setoran SABAQ pada satu halaman tidak boleh melebihi 1.0 halaman.`,
      };
    }
    return { valid: true, existingVolume, newTotal: existingVolume + params.jumlahHalamanBaru };
  }

  // Helper validasi Sabaqi di server (tahfizh.ts)
  function validasiInputSabaqiServer(params: {
    jenis: "SABAQ" | "SABQI" | "MANZIL" | "MUFAR";
    sabaqPekanList: Array<{
      id: string;
      jenis: string;
      status: "AKTIF" | "DIBATALKAN";
    }>;
    isManualSabaqi?: boolean;
    alasanManualSabaqi?: string;
  }) {
    if (params.jenis !== "SABQI") return { valid: true };

    const activeSabaqPekan = params.sabaqPekanList.filter(
      (s) => s.status !== "DIBATALKAN" && s.jenis === "SABAQ"
    );

    if (activeSabaqPekan.length === 0) {
      if (
        !params.isManualSabaqi ||
        !params.alasanManualSabaqi?.trim() ||
        params.alasanManualSabaqi.trim().length < 5
      ) {
        return {
          valid: false,
          message:
            "Belum ada catatan setoran SABAQ sah pekan ini. Input manual SABQI wajib mencentang opsi manual dan mengisi alasan minimal 5 karakter.",
        };
      }
    }

    return { valid: true };
  }

  describe("1. Otomatisasi Saran Posisi SABAQ", () => {
    it("harus menyarankan halaman 422 untuk Obama (modal 420 + sabaq 421 genap 1.0)", () => {
      const baseline = new Date("2026-09-08T00:00:00Z");
      const res = hitungPosisiDanSaranSabaq({
        modalHalamanAwal: 420,
        tanggalBaselineTahfizh: baseline,
        setoranList: [
          {
            id: "s-421",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 421,
            halamanSelesai: 421,
            createdAt: new Date("2026-09-09T08:00:00Z"),
            status: "AKTIF",
          },
        ],
      });

      assert.equal(res.posisiTerakhirHalaman, 421);
      assert.equal(res.isHalamanTerakhirParsial, false);
      assert.equal(res.saranHalamanMulai, 422);
      assert.equal(res.saranHalamanSelesai, 422);
      assert.equal(res.saranJumlahHalaman, 1);
    });

    it("harus menyarankan modal + 1 jika santri belum memiliki SABAQ baru setelah baseline", () => {
      const baseline = new Date("2026-09-08T00:00:00Z");
      const res = hitungPosisiDanSaranSabaq({
        modalHalamanAwal: 100,
        tanggalBaselineTahfizh: baseline,
        setoranList: [],
      });

      assert.equal(res.posisiTerakhirHalaman, 100);
      assert.equal(res.isHalamanTerakhirParsial, false);
      assert.equal(res.saranHalamanMulai, 101);
      assert.equal(res.saranHalamanSelesai, 101);
      assert.equal(res.saranJumlahHalaman, 1);
    });

    it("harus menyarankan halaman 1 jika santri baru dengan modal 0 dan belum ada sabaq", () => {
      const baseline = new Date("2026-09-08T00:00:00Z");
      const res = hitungPosisiDanSaranSabaq({
        modalHalamanAwal: 0,
        tanggalBaselineTahfizh: baseline,
        setoranList: [],
      });

      assert.equal(res.posisiTerakhirHalaman, 0);
      assert.equal(res.isHalamanTerakhirParsial, false);
      assert.equal(res.saranHalamanMulai, 1);
      assert.equal(res.saranHalamanSelesai, 1);
      assert.equal(res.saranJumlahHalaman, 1);
    });

    it("tidak boleh terpengaruh setoran SABQI, MANZIL, MUFAR, atau DIBATALKAN untuk menentukan posisi lanjutan", () => {
      const baseline = new Date("2026-09-08T00:00:00Z");
      const res = hitungPosisiDanSaranSabaq({
        modalHalamanAwal: 420,
        tanggalBaselineTahfizh: baseline,
        setoranList: [
          // SABAQ sah terakhir di 421
          {
            id: "s-421",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 421,
            halamanSelesai: 421,
            createdAt: new Date("2026-09-09T08:00:00Z"),
            status: "AKTIF",
          },
          // MANZIL di juz 1 (hlm 1-20)
          {
            id: "s-manzil",
            jenis: "MANZIL",
            jumlahHalaman: 20,
            halamanMulai: 1,
            halamanSelesai: 20,
            createdAt: new Date("2026-09-09T09:00:00Z"),
            status: "AKTIF",
          },
          // SABAQ 582 yang DIBATALKAN
          {
            id: "s-582-cancel",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 582,
            halamanSelesai: 582,
            createdAt: new Date("2026-09-09T10:00:00Z"),
            status: "DIBATALKAN",
          },
        ],
      });

      // Tetap posisi 421 dan saran 422
      assert.equal(res.posisiTerakhirHalaman, 421);
      assert.equal(res.saranHalamanMulai, 422);
    });
  });

  describe("2. Penanganan Khusus Setengah Halaman (0.5 Halaman)", () => {
    it("harus menyarankan nomor halaman yang SAMA jika setoran terakhir hanya 0.5 halaman", () => {
      const baseline = new Date("2026-09-08T00:00:00Z");
      const res = hitungPosisiDanSaranSabaq({
        modalHalamanAwal: 420,
        tanggalBaselineTahfizh: baseline,
        setoranList: [
          {
            id: "s-421-half",
            jenis: "SABAQ",
            jumlahHalaman: 0.5,
            halamanMulai: 421,
            halamanSelesai: 421,
            createdAt: new Date("2026-09-09T08:00:00Z"),
            status: "AKTIF",
          },
        ],
      });

      assert.equal(res.posisiTerakhirHalaman, 421);
      assert.equal(res.isHalamanTerakhirParsial, true);
      // Saran tetap 421 dengan sisa 0.5
      assert.equal(res.saranHalamanMulai, 421);
      assert.equal(res.saranHalamanSelesai, 421);
      assert.equal(res.saranJumlahHalaman, 0.5);
    });

    it("harus memajukan ke halaman berikutnya setelah setoran kedua 0.5 menggenapkan halaman menjadi 1.0", () => {
      const baseline = new Date("2026-09-08T00:00:00Z");
      const res = hitungPosisiDanSaranSabaq({
        modalHalamanAwal: 420,
        tanggalBaselineTahfizh: baseline,
        setoranList: [
          {
            id: "s-421-half-1",
            jenis: "SABAQ",
            jumlahHalaman: 0.5,
            halamanMulai: 421,
            halamanSelesai: 421,
            createdAt: new Date("2026-09-09T08:00:00Z"),
            status: "AKTIF",
          },
          {
            id: "s-421-half-2",
            jenis: "SABAQ",
            jumlahHalaman: 0.5,
            halamanMulai: 421,
            halamanSelesai: 421,
            createdAt: new Date("2026-09-09T14:00:00Z"),
            status: "AKTIF",
          },
        ],
      });

      assert.equal(res.posisiTerakhirHalaman, 421);
      assert.equal(res.isHalamanTerakhirParsial, false);
      // Karena sudah genap 1.0 di hlm 421, saran maju ke 422
      assert.equal(res.saranHalamanMulai, 422);
      assert.equal(res.saranHalamanSelesai, 422);
      assert.equal(res.saranJumlahHalaman, 1);
    });

    it("server harus menolak setoran SABAQ jika akumulasi pada halaman yang sama melebihi 1.0 halaman", () => {
      const existing = [
        {
          halamanMulai: 421,
          halamanSelesai: 421,
          jumlahHalaman: 0.5,
          status: "AKTIF" as const,
        },
        {
          halamanMulai: 421,
          halamanSelesai: 421,
          jumlahHalaman: 0.5,
          status: "AKTIF" as const,
        },
      ];

      // Coba setor lagi 0.5 di 421
      const check1 = validasiKapasitasHalamanSabaq({
        targetHalaman: 421,
        jumlahHalamanBaru: 0.5,
        existingSetoranSabaq: existing,
      });
      assert.equal(check1.valid, false);

      // Coba setor 1.0 di 421
      const check2 = validasiKapasitasHalamanSabaq({
        targetHalaman: 421,
        jumlahHalamanBaru: 1.0,
        existingSetoranSabaq: existing,
      });
      assert.equal(check2.valid, false);
    });
  });

  describe("3. Filter Rekomendasi & Validasi Server SABQI", () => {
    it("harus menolak request SABQI di server jika tidak ada SABAQ aktif pekan ini dan tanpa alasan manual", () => {
      const res = validasiInputSabaqiServer({
        jenis: "SABQI",
        sabaqPekanList: [],
        isManualSabaqi: false,
      });
      assert.equal(res.valid, false);
    });

    it("harus menolak request SABQI manual jika alasan kurang dari 5 karakter", () => {
      const res = validasiInputSabaqiServer({
        jenis: "SABQI",
        sabaqPekanList: [],
        isManualSabaqi: true,
        alasanManualSabaqi: "test", // 4 karakter
      });
      assert.equal(res.valid, false);
    });

    it("harus menerima request SABQI manual jika isManualSabaqi = true dan alasan >= 5 karakter", () => {
      const res = validasiInputSabaqiServer({
        jenis: "SABQI",
        sabaqPekanList: [],
        isManualSabaqi: true,
        alasanManualSabaqi: "Mengulang sabaq pekan lalu karena izin sakit.",
      });
      assert.equal(res.valid, true);
    });

    it("tidak boleh menghitung setoran SABAQ yang DIBATALKAN sebagai dasar rekomendasi SABQI", () => {
      const sabaqPekanList = [
        {
          id: "s-582-cancel",
          jenis: "SABAQ",
          status: "DIBATALKAN" as const,
        },
      ];
      const res = validasiInputSabaqiServer({
        jenis: "SABQI",
        sabaqPekanList,
        isManualSabaqi: false,
      });
      // Karena yang ada hanya DIBATALKAN, harus dianggap belum ada sabaq pekan ini
      assert.equal(res.valid, false);
    });
  });

  describe("4. Batas Akhir Mushaf (Halaman 604 Khatam)", () => {
    it("tidak boleh menyarankan halaman 605 jika santri telah mencapai halaman 604", () => {
      const baseline = new Date("2026-09-08T00:00:00Z");
      const res = hitungPosisiDanSaranSabaq({
        modalHalamanAwal: 603,
        tanggalBaselineTahfizh: baseline,
        setoranList: [
          {
            id: "s-604",
            jenis: "SABAQ",
            jumlahHalaman: 1,
            halamanMulai: 604,
            halamanSelesai: 604,
            createdAt: new Date("2026-09-09T08:00:00Z"),
            status: "AKTIF",
          },
        ],
      });

      assert.equal(res.posisiTerakhirHalaman, 604);
      assert.equal(res.isHalamanTerakhirParsial, false);
      assert.equal(res.saranHalamanMulai, 604);
      assert.equal(res.saranHalamanSelesai, 604);
    });
  });

  describe("5. Deteksi Perbedaan dari Saran (Poin 6)", () => {
    function deteksiPerbedaanSaran(saran: number, diinput: number, posisiTerakhir: number, isParsial: boolean) {
      if (diinput === saran) return { beda: false };
      if (diinput > saran) return { beda: true, tipe: "LOMPAT_MAJU" };
      if (diinput === posisiTerakhir && !isParsial) return { beda: true, tipe: "PENGULANGAN" };
      return { beda: true, tipe: "MUNDUR" };
    }

    it("harus mendeteksi LOMPAT_MAJU jika input halaman lebih besar dari saran", () => {
      const check = deteksiPerbedaanSaran(422, 582, 421, false);
      assert.equal(check.beda, true);
      assert.equal(check.tipe, "LOMPAT_MAJU");
    });

    it("harus mendeteksi PENGULANGAN jika musyrif memasukkan kembali halaman posisi terakhir yang sudah penuh", () => {
      const check = deteksiPerbedaanSaran(422, 421, 421, false);
      assert.equal(check.beda, true);
      assert.equal(check.tipe, "PENGULANGAN");
    });

    it("harus mendeteksi MUNDUR jika musyrif memasukkan halaman sebelum posisi terakhir", () => {
      const check = deteksiPerbedaanSaran(422, 415, 421, false);
      assert.equal(check.beda, true);
      assert.equal(check.tipe, "MUNDUR");
    });

    it("tidak ada perbedaan jika input persis sama dengan saran", () => {
      const check = deteksiPerbedaanSaran(422, 422, 421, false);
      assert.equal(check.beda, false);
    });
  });
});
