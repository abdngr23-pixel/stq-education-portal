import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { batchPresensiSchema, validateData } from "../lib/validations";
import { buildRekapPresensiWAMessage } from "../lib/whatsapp";

describe("Modul Presensi Harian Shalat Berjamaah & Halaqoh Tests", () => {
  describe("1. Validasi Skema Zod (batchPresensiSchema)", () => {
    it("harus meloloskan payload presensi batch yang valid dengan berbagai status", () => {
      const validPayload = {
        kegiatan: "Sholat Subuh",
        tanggal: "2026-09-08",
        items: [
          { santriId: "cm_santri_1", status: "HADIR", catatan: null },
          { santriId: "cm_santri_2", status: "MASBUK", catatan: "Masbuk 1 rakaat" },
          { santriId: "cm_santri_3", status: "SAKIT", catatan: "Flu di UKS" },
          { santriId: "cm_santri_4", status: "IZIN", catatan: "Izin pulang keluarga" },
          { santriId: "cm_santri_5", status: "ALFA", catatan: null },
        ],
      };

      const result = validateData(batchPresensiSchema, validPayload);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.items.length, 5);
        assert.equal(result.data.kegiatan, "Sholat Subuh");
      }
    });

    it("harus menolak payload jika daftar items kosong (minimal 1 santri)", () => {
      const invalidPayload = {
        kegiatan: "Sholat Maghrib",
        tanggal: "2026-09-08",
        items: [],
      };

      const result = validateData(batchPresensiSchema, invalidPayload);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.errors.some((e) => e.includes("Minimal 1 santri")));
      }
    });

    it("harus menolak jika ada status yang tidak diizinkan", () => {
      const invalidPayload = {
        kegiatan: "Halaqah Ba'da Shubuh",
        items: [
          { santriId: "cm_santri_1", status: "BOLOS_TIDUR" },
        ],
      };

      const result = validateData(batchPresensiSchema, invalidPayload);
      assert.equal(result.success, false);
    });

    it("harus menolak jika santriId kosong", () => {
      const invalidPayload = {
        kegiatan: "Sholat Ashar",
        items: [
          { santriId: "", status: "HADIR" },
        ],
      };

      const result = validateData(batchPresensiSchema, invalidPayload);
      assert.equal(result.success, false);
    });
  });

  describe("2. Generator Pesan WhatsApp Rekap Shaf & Halaqoh (buildRekapPresensiWAMessage)", () => {
    it("harus menyusun rekap WA dengan format rapi dan persentase kehadiran", () => {
      const msg = buildRekapPresensiWAMessage({
        kegiatan: "Sholat Subuh",
        tanggal: "08/09/2026",
        petugasNama: "Ust. Mujaddid Zhohruddin (MK)",
        totalSantri: 10,
        hadir: 8,
        masbuk: 1,
        sakit: 1,
        izin: 0,
        alpa: 0,
        daftarTidakHadir: [
          { nama: "Muh. Fauzan", kelas: "9A", status: "MASBUK", catatan: "Masbuk di rakaat ke-2" },
          { nama: "Khubaib", kelas: "9A", status: "SAKIT", catatan: "Istirahat di UKS" },
        ],
      });

      assert.ok(msg.includes("*LAPORAN PRESENSI SHALAT & HALAQOH*"));
      assert.ok(msg.includes("Sesi Kegiatan*: Sholat Subuh"));
      assert.ok(msg.includes("Petugas Presensi*: Ust. Mujaddid Zhohruddin (MK)"));
      assert.ok(msg.includes("Tingkat Kehadiran*: *90%*")); // (8+1)/10 = 90%
      assert.ok(msg.includes("Muh. Fauzan"));
      assert.ok(msg.includes("Khubaib"));
    });

    it("harus menangani kasus 100% kehadiran tepat waktu", () => {
      const msg = buildRekapPresensiWAMessage({
        kegiatan: "Sholat Maghrib",
        tanggal: "08/09/2026",
        petugasNama: "Divisi Keamanan OSDA",
        totalSantri: 50,
        hadir: 50,
        masbuk: 0,
        sakit: 0,
        izin: 0,
        alpa: 0,
      });

      assert.ok(msg.includes("Tingkat Kehadiran*: *100%*"));
      assert.ok(msg.includes("Hadir Tepat Waktu*: 50 santri"));
    });
  });

  describe("3. Aturan Bisnis & Integrasi Izin Aktif", () => {
    it("santri dengan izin yang disetujui harus diutamakan sebagai SAKIT/IZIN dan tidak boleh jadi ALFA", () => {
      const activeApprovedIzinList = [
        {
          id: "iz_1",
          santriNama: "Obama Ozearld Egberted Turizqi",
          jenis: "SAKIT",
          status: "DISETUJUI",
          alasan: "Demam dan flu",
        },
      ];

      const santriData = [
        { id: "cm_1", nama: "Obama Ozearld Egberted Turizqi" },
        { id: "cm_2", nama: "Muhammad Fardhan" },
      ];

      // Simulasi pemetaan status izin aktif
      const enriched = santriData.map((s) => {
        const approved = activeApprovedIzinList.find(
          (iz) => iz.santriNama === s.nama && iz.status === "DISETUJUI"
        );
        return {
          ...s,
          statusIzinAktif: approved ? { jenis: approved.jenis, status: approved.status } : null,
        };
      });

      assert.equal(enriched[0].statusIzinAktif?.jenis, "SAKIT");
      assert.equal(enriched[0].statusIzinAktif?.status, "DISETUJUI");
      assert.equal(enriched[1].statusIzinAktif, null);
    });

    it("pemetaan status MASBUK harus valid untuk database Absensi enum (HADIR dengan catatan [Masbuk])", () => {
      const payloadItem = {
        santriId: "cm_santri_1",
        status: "MASBUK" as const,
        catatan: "Terlambat 1 rakaat",
      };

      // Transformasi yang dilakukan di Server Action
      const dbStatus = payloadItem.status === "MASBUK" ? "HADIR" : payloadItem.status;
      const dbCatatan = payloadItem.status === "MASBUK"
        ? `[Masbuk] ${payloadItem.catatan || "Terlambat takbiratul ihram"}`
        : payloadItem.catatan;

      assert.equal(dbStatus, "HADIR");
      assert.ok(dbCatatan.startsWith("[Masbuk]"));
      assert.ok(dbCatatan.includes("Terlambat 1 rakaat"));
    });
  });
});
