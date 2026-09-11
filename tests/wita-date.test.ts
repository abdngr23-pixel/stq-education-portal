// Unit Test Pengujian Zona Waktu WITA (Asia/Makassar) untuk Batas Hari Operasional Pesantren
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getWitaDateString,
  isSameDayWita,
  isTodayWita,
  isYesterdayWita,
} from "../lib/wita-date";

describe("WITA Date Utility (Asia/Makassar, UTC+8)", () => {
  it("harus mengembalikan string tanggal YYYY-MM-DD sesuai zona waktu Asia/Makassar", () => {
    // 2026-09-11 pukul 00:30 UTC = 2026-09-11 pukul 08:30 WITA
    const d1 = new Date("2026-09-11T00:30:00.000Z");
    assert.equal(getWitaDateString(d1), "2026-09-11");

    // 2026-09-10 pukul 16:00 UTC = 2026-09-11 pukul 00:00 WITA (sudah berganti hari di WITA!)
    const d2 = new Date("2026-09-10T16:00:00.000Z");
    assert.equal(getWitaDateString(d2), "2026-09-11");

    // 2026-09-10 pukul 15:59 UTC = 2026-09-10 pukul 23:59 WITA (masih hari sebelumnya di WITA)
    const d3 = new Date("2026-09-10T15:59:59.000Z");
    assert.equal(getWitaDateString(d3), "2026-09-10");

    assert.equal(isSameDayWita(d1, d2), true);
    assert.equal(isSameDayWita(d1, d3), false);
  });

  it("harus mendeteksi setoran hari ini WITA dengan tepat", () => {
    // Acuan waktu: 11 September 2026 pukul 08:00 WITA (00:00 UTC)
    const refNow = new Date("2026-09-11T00:00:00.000Z");

    // Setoran masuk pada 11 September 2026 pukul 06:00 WITA (2026-09-10T22:00:00.000Z)
    const setoranPagi = new Date("2026-09-10T22:00:00.000Z");
    assert.equal(isTodayWita(setoranPagi, refNow), true);

    // Setoran masuk pada 11 September 2026 pukul 14:00 WITA (2026-09-11T06:00:00.000Z)
    const setoranSiang = new Date("2026-09-11T06:00:00.000Z");
    assert.equal(isTodayWita(setoranSiang, refNow), true);
  });

  it("harus mendeteksi setoran kemarin WITA dengan tepat", () => {
    // Acuan waktu: 11 September 2026 pukul 10:00 WITA
    const refNow = new Date("2026-09-11T02:00:00.000Z");

    // Setoran kemarin: 10 September 2026 pukul 21:00 WITA (10 Sept 13:00 UTC)
    const setoranKemarinMalam = new Date("2026-09-10T13:00:00.000Z");
    assert.equal(isYesterdayWita(setoranKemarinMalam, refNow), true);
    assert.equal(isTodayWita(setoranKemarinMalam, refNow), false);

    // Setoran dua hari lalu: 9 September 2026 pukul 10:00 WITA
    const setoranDuaHariLalu = new Date("2026-09-09T02:00:00.000Z");
    assert.equal(isYesterdayWita(setoranDuaHariLalu, refNow), false);
    assert.equal(isTodayWita(setoranDuaHariLalu, refNow), false);
  });

  it("harus menangani titik batas pergantian hari UTC vs WITA secara akurat", () => {
    // Acuan: 11 September 2026 pukul 01:00 WITA (10 September 2026 pukul 17:00 UTC)
    // Di UTC masih tanggal 10, tetapi di WITA sudah tanggal 11!
    const refEarlyMorningWita = new Date("2026-09-10T17:00:00.000Z");

    // Setoran dibuat 10 menit sebelumnya: 11 September 2026 pukul 00:50 WITA (10 Sept 16:50 UTC)
    const setoranEarlyMorning = new Date("2026-09-10T16:50:00.000Z");
    assert.equal(isTodayWita(setoranEarlyMorning, refEarlyMorningWita), true);

    // Setoran dibuat 1 jam 10 menit sebelumnya: 10 September 2026 pukul 23:50 WITA (10 Sept 15:50 UTC)
    const setoranLateNightYesterday = new Date("2026-09-10T15:50:00.000Z");
    assert.equal(isTodayWita(setoranLateNightYesterday, refEarlyMorningWita), false);
    assert.equal(isYesterdayWita(setoranLateNightYesterday, refEarlyMorningWita), true);
  });

  it("harus menangani nilai null, undefined, atau string tanggal invalid tanpa crash", () => {
    assert.equal(getWitaDateString(null), "");
    assert.equal(getWitaDateString(undefined), "");
    assert.equal(getWitaDateString("invalid-date-string"), "");

    assert.equal(isTodayWita(null), false);
    assert.equal(isTodayWita(undefined), false);
    assert.equal(isTodayWita("bukan-tanggal"), false);

    assert.equal(isYesterdayWita(null), false);
    assert.equal(isYesterdayWita("invalid"), false);
  });
});
