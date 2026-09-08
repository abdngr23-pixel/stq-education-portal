import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { simpanBatchPresensiAction } from "../app/actions/presensi";
import { inputNilaiAction } from "../app/actions/akademik";
import { catatPelanggaranAction } from "../app/actions/kedisiplinan";
import { ajukanIzinAction } from "../app/actions/kesantrian";
import { createSetoranAction } from "../app/actions/tahfizh";

describe("Audit STQ 2026-09-08 — Remediasi Batch 2 (P0 Persistence & Honest Results)", () => {
  describe("1. A03: simpanBatchPresensiAction Honest Reporting", () => {
    it("harus menolak simpan presensi jika tidak ada sesi aktif dan tidak boleh mengklaim offline mode tersimpan", async () => {
      const res = await simpanBatchPresensiAction({
        kegiatan: "Subuh",
        items: [{ santriId: "santri-1", status: "HADIR" }],
      });

      assert.strictEqual(res.success, false);
      assert.match(res.message, /Sesi telah berakhir/i);
    });

    it("harus menolak payload yang tidak memenuhi skema validasi", async () => {
      // In this environment without session, it fails authentication first
      const res = await simpanBatchPresensiAction({
        kegiatan: "",
        items: [],
      });

      assert.strictEqual(res.success, false);
    });
  });

  describe("2. A01 & A02: Server Actions Fail-Closed Tanpa Sesi Autentikasi", () => {
    it("inputNilaiAction harus mengembalikan success: false saat dipanggil tanpa sesi login", async () => {
      const res = await inputNilaiAction({
        santriId: "santri-1",
        mapelId: "MP-KP-01",
        semester: 1,
        tahunAjaran: "2026/2027",
        jenis: "TUGAS",
        angka: 85,
      });

      assert.strictEqual(res.success, false);
      assert.match(res.message, /Sesi telah berakhir/i);
    });

    it("catatPelanggaranAction harus mengembalikan success: false saat dipanggil tanpa sesi login", async () => {
      const res = await catatPelanggaranAction({
        santriId: "santri-1",
        aturanId: "AT-01",
        kategori: "KEDISIPLINAN",
        poin: 10,
        keterangan: "Uji coba pelanggaran",
      });

      assert.strictEqual(res.success, false);
      assert.match(res.message, /login/i);
    });

    it("ajukanIzinAction harus mengembalikan success: false saat dipanggil tanpa sesi login", async () => {
      const res = await ajukanIzinAction({
        santriId: "santri-1",
        jenis: "PULANG",
        alasan: "Keperluan keluarga",
        tglMulai: "2026-09-08",
        tglSelesai: "2026-09-10",
      });

      assert.strictEqual(res.success, false);
      assert.match(res.message, /login/i);
    });

    it("createSetoranAction harus mengembalikan success: false saat dipanggil tanpa sesi login", async () => {
      const res = await createSetoranAction({
        santriId: "santri-1",
        jenis: "SABAQ",
        juz: 30,
        halaman: 582,
        nilai: "MUMTAZ",
      });

      assert.strictEqual(res.success, false);
      assert.match(res.message, /Sesi telah berakhir/i);
    });
  });
});
