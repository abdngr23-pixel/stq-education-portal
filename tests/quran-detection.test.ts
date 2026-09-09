import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SURAH_LIST,
  JUZ_LIST,
  getSurahListByJuz,
  getJuzByPage,
  getAbsolutePage,
  detectSurahByJuzPageVerse,
} from "../lib/quran-metadata";

describe("Deteksi Pintar Nama Surah Al-Qur'an (Tahfizh Setoran)", () => {
  describe("1. Validasi Metadata Dasar Al-Qur'an", () => {
    it("harus memiliki tepat 114 surah dengan nomor urut 1 sampai 114", () => {
      assert.equal(SURAH_LIST.length, 114);
      assert.equal(SURAH_LIST[0].name, "Al-Fatihah");
      assert.equal(SURAH_LIST[113].name, "An-Nas");
      SURAH_LIST.forEach((s, idx) => {
        assert.equal(s.number, idx + 1);
        assert.ok(s.totalAyat > 0);
        assert.ok(s.startPage >= 1 && s.startPage <= 604);
        assert.ok(s.endPage >= s.startPage && s.endPage <= 604);
      });
    });

    it("harus memiliki tepat 30 Juz dengan halaman awal dan akhir yang valid", () => {
      assert.equal(JUZ_LIST.length, 30);
      assert.equal(JUZ_LIST[0].juz, 1);
      assert.equal(JUZ_LIST[0].startPage, 1);
      assert.equal(JUZ_LIST[29].juz, 30);
      assert.equal(JUZ_LIST[29].endPage, 604);
    });
  });

  describe("2. Konversi Halaman & Pencarian Juz", () => {
    it("harus mendeteksi juz dari nomor halaman Mushaf Madinah", () => {
      assert.equal(getJuzByPage(1), 1);
      assert.equal(getJuzByPage(462), 24);
      assert.equal(getJuzByPage(467), 24);
      assert.equal(getJuzByPage(582), 30);
      assert.equal(getJuzByPage(604), 30);
    });

    it("harus mengonversi nomor halaman dalam juz (1-20) ke halaman absolut Mushaf Madinah", () => {
      // Juz 24 dimulai di halaman 462
      assert.equal(getAbsolutePage(24, 1), 462);
      assert.equal(getAbsolutePage(24, 6), 467);
      assert.equal(getAbsolutePage(24, 16), 477);

      // Juz 30 dimulai di halaman 582
      assert.equal(getAbsolutePage(30, 1), 582);
      assert.equal(getAbsolutePage(30, 2), 583);

      // Jika input sudah nomor halaman absolut Mushaf (> 20)
      assert.equal(getAbsolutePage(24, 467), 467);
      assert.equal(getAbsolutePage(30, 604), 604);
    });
  });

  describe("3. Algoritma Deteksi Pintar Surah", () => {
    it("harus mendeteksi Az-Zumar untuk Juz 24 Halaman 1 (Hal 462)", () => {
      const res = detectSurahByJuzPageVerse({ juz: 24, halaman: 1 });
      assert.equal(res.surahMulai, "Az-Zumar");
      assert.equal(res.halamanMushaf, 462);
      assert.equal(res.detectedJuz, 24);
    });

    it("harus mendeteksi Ghafir untuk Juz 24 Halaman 6 atau Halaman Mushaf 467", () => {
      const res1 = detectSurahByJuzPageVerse({ juz: 24, halaman: 6 });
      assert.equal(res1.surahMulai, "Ghafir");

      const res2 = detectSurahByJuzPageVerse({ juz: 24, halaman: 467 });
      assert.equal(res2.surahMulai, "Ghafir");
    });

    it("harus mendeteksi Fushshilat untuk Juz 24 Halaman 16 atau Halaman Mushaf 477", () => {
      const res = detectSurahByJuzPageVerse({ juz: 24, halaman: 16 });
      assert.equal(res.surahMulai, "Fushshilat");
    });

    it("harus mendeteksi An-Naba' untuk Juz 30 Halaman 1 atau Halaman Mushaf 582", () => {
      const res = detectSurahByJuzPageVerse({ juz: 30, halaman: 1 });
      assert.equal(res.surahMulai, "An-Naba'");
      assert.equal(res.halamanMushaf, 582);
    });

    it("harus mendeteksi An-Nazi'at untuk Juz 30 Halaman 2 atau Halaman Mushaf 583", () => {
      const res = detectSurahByJuzPageVerse({ juz: 30, halaman: 583 });
      assert.equal(res.surahMulai, "An-Nazi'at");
    });

    it("harus mendeteksi surah pembuka Juz saat hanya Juz yang diberikan", () => {
      const resJuz1 = detectSurahByJuzPageVerse({ juz: 1 });
      assert.equal(resJuz1.surahMulai, "Al-Fatihah");

      const resJuz2 = detectSurahByJuzPageVerse({ juz: 2 });
      assert.equal(resJuz2.surahMulai, "Al-Baqarah");

      const resJuz24 = detectSurahByJuzPageVerse({ juz: 24 });
      assert.equal(resJuz24.surahMulai, "Az-Zumar");
    });

    it("harus mengembalikan daftar surah yang valid untuk setiap Juz", () => {
      const surahsJuz24 = getSurahListByJuz(24);
      assert.deepEqual(
        surahsJuz24.map((s) => s.name),
        ["Az-Zumar", "Ghafir", "Fushshilat"]
      );

      const surahsJuz1 = getSurahListByJuz(1);
      assert.deepEqual(
        surahsJuz1.map((s) => s.name),
        ["Al-Fatihah", "Al-Baqarah"]
      );
    });
  });
});
