/**
 * Metadata Resmi Al-Qur'an Standar Rasm Utsmani (Mushaf Madinah 604 Halaman, 30 Juz, 114 Surah)
 * Digunakan untuk deteksi pintar nama surah, validasi setoran tahfizh, dan kalkulasi capaian hafalan.
 */

export interface SurahMeta {
  number: number;
  name: string;
  arabicName: string;
  totalAyat: number;
  startPage: number;
  endPage: number;
  juzStart: number;
}

export interface JuzMeta {
  juz: number;
  startPage: number;
  endPage: number;
  startSurah: string;
  startSurahNumber: number;
  startAyat: number;
  endSurah: string;
  endSurahNumber: number;
  endAyat: number;
  surahNumbers: number[];
}

export const SURAH_LIST: SurahMeta[] = [
  { number: 1, name: "Al-Fatihah", arabicName: "الفاتحة", totalAyat: 7, startPage: 1, endPage: 1, juzStart: 1 },
  { number: 2, name: "Al-Baqarah", arabicName: "البقرة", totalAyat: 286, startPage: 2, endPage: 49, juzStart: 1 },
  { number: 3, name: "Ali 'Imran", arabicName: "آل عمران", totalAyat: 200, startPage: 50, endPage: 76, juzStart: 3 },
  { number: 4, name: "An-Nisa'", arabicName: "النساء", totalAyat: 176, startPage: 77, endPage: 106, juzStart: 4 },
  { number: 5, name: "Al-Ma'idah", arabicName: "المائدة", totalAyat: 120, startPage: 106, endPage: 127, juzStart: 6 },
  { number: 6, name: "Al-An'am", arabicName: "الأنعام", totalAyat: 165, startPage: 128, endPage: 150, juzStart: 7 },
  { number: 7, name: "Al-A'raf", arabicName: "الأعراف", totalAyat: 206, startPage: 151, endPage: 176, juzStart: 8 },
  { number: 8, name: "Al-Anfal", arabicName: "الأنفال", totalAyat: 75, startPage: 177, endPage: 186, juzStart: 9 },
  { number: 9, name: "At-Taubah", arabicName: "التوبة", totalAyat: 129, startPage: 187, endPage: 207, juzStart: 10 },
  { number: 10, name: "Yunus", arabicName: "يونس", totalAyat: 109, startPage: 208, endPage: 221, juzStart: 11 },
  { number: 11, name: "Hud", arabicName: "هود", totalAyat: 123, startPage: 221, endPage: 235, juzStart: 11 },
  { number: 12, name: "Yusuf", arabicName: "يوسف", totalAyat: 111, startPage: 235, endPage: 248, juzStart: 12 },
  { number: 13, name: "Ar-Ra'd", arabicName: "الرعد", totalAyat: 43, startPage: 249, endPage: 255, juzStart: 13 },
  { number: 14, name: "Ibrahim", arabicName: "إبراهيم", totalAyat: 52, startPage: 255, endPage: 261, juzStart: 13 },
  { number: 15, name: "Al-Hijr", arabicName: "الحجر", totalAyat: 99, startPage: 262, endPage: 267, juzStart: 14 },
  { number: 16, name: "An-Nahl", arabicName: "النحل", totalAyat: 128, startPage: 267, endPage: 281, juzStart: 14 },
  { number: 17, name: "Al-Isra'", arabicName: "الإسراء", totalAyat: 111, startPage: 282, endPage: 293, juzStart: 15 },
  { number: 18, name: "Al-Kahf", arabicName: "الكهف", totalAyat: 110, startPage: 293, endPage: 304, juzStart: 15 },
  { number: 19, name: "Maryam", arabicName: "مريم", totalAyat: 98, startPage: 305, endPage: 312, juzStart: 16 },
  { number: 20, name: "Thaha", arabicName: "طه", totalAyat: 135, startPage: 312, endPage: 321, juzStart: 16 },
  { number: 21, name: "Al-Anbiya'", arabicName: "الأنبياء", totalAyat: 112, startPage: 322, endPage: 331, juzStart: 17 },
  { number: 22, name: "Al-Hajj", arabicName: "الحج", totalAyat: 78, startPage: 332, endPage: 341, juzStart: 17 },
  { number: 23, name: "Al-Mu'minun", arabicName: "المؤمنون", totalAyat: 118, startPage: 342, endPage: 349, juzStart: 18 },
  { number: 24, name: "An-Nur", arabicName: "النور", totalAyat: 64, startPage: 350, endPage: 359, juzStart: 18 },
  { number: 25, name: "Al-Furqan", arabicName: "الفرقان", totalAyat: 77, startPage: 359, endPage: 366, juzStart: 18 },
  { number: 26, name: "Asy-Syu'ara'", arabicName: "الشعراء", totalAyat: 227, startPage: 367, endPage: 376, juzStart: 19 },
  { number: 27, name: "An-Naml", arabicName: "النمل", totalAyat: 93, startPage: 377, endPage: 385, juzStart: 19 },
  { number: 28, name: "Al-Qashash", arabicName: "القصص", totalAyat: 88, startPage: 385, endPage: 396, juzStart: 20 },
  { number: 29, name: "Al-'Ankabut", arabicName: "العنكبوت", totalAyat: 69, startPage: 396, endPage: 404, juzStart: 20 },
  { number: 30, name: "Ar-Rum", arabicName: "الروم", totalAyat: 60, startPage: 404, endPage: 410, juzStart: 21 },
  { number: 31, name: "Luqman", arabicName: "لقمان", totalAyat: 34, startPage: 411, endPage: 414, juzStart: 21 },
  { number: 32, name: "As-Sajdah", arabicName: "السجدة", totalAyat: 30, startPage: 415, endPage: 417, juzStart: 21 },
  { number: 33, name: "Al-Ahzab", arabicName: "الأحزاب", totalAyat: 73, startPage: 418, endPage: 427, juzStart: 21 },
  { number: 34, name: "Saba'", arabicName: "سبأ", totalAyat: 54, startPage: 428, endPage: 434, juzStart: 22 },
  { number: 35, name: "Fathir", arabicName: "فاطر", totalAyat: 45, startPage: 434, endPage: 440, juzStart: 22 },
  { number: 36, name: "Yasin", arabicName: "يس", totalAyat: 83, startPage: 440, endPage: 445, juzStart: 22 },
  { number: 37, name: "Ash-Shaffat", arabicName: "الصافات", totalAyat: 182, startPage: 446, endPage: 452, juzStart: 23 },
  { number: 38, name: "Shad", arabicName: "ص", totalAyat: 88, startPage: 453, endPage: 458, juzStart: 23 },
  { number: 39, name: "Az-Zumar", arabicName: "الزمر", totalAyat: 75, startPage: 458, endPage: 467, juzStart: 23 },
  { number: 40, name: "Ghafir", arabicName: "غافر", totalAyat: 85, startPage: 467, endPage: 476, juzStart: 24 },
  { number: 41, name: "Fushshilat", arabicName: "فصلت", totalAyat: 54, startPage: 477, endPage: 482, juzStart: 24 },
  { number: 42, name: "Asy-Syura", arabicName: "الشورى", totalAyat: 53, startPage: 483, endPage: 489, juzStart: 25 },
  { number: 43, name: "Az-Zukhruf", arabicName: "الزخرف", totalAyat: 89, startPage: 489, endPage: 495, juzStart: 25 },
  { number: 44, name: "Ad-Dukhan", arabicName: "الدخان", totalAyat: 59, startPage: 496, endPage: 498, juzStart: 25 },
  { number: 45, name: "Al-Jatsiyah", arabicName: "الجاثية", totalAyat: 37, startPage: 499, endPage: 502, juzStart: 25 },
  { number: 46, name: "Al-Ahqaf", arabicName: "الأحقاف", totalAyat: 35, startPage: 502, endPage: 506, juzStart: 26 },
  { number: 47, name: "Muhammad", arabicName: "محمد", totalAyat: 38, startPage: 507, endPage: 510, juzStart: 26 },
  { number: 48, name: "Al-Fath", arabicName: "الفتح", totalAyat: 29, startPage: 511, endPage: 515, juzStart: 26 },
  { number: 49, name: "Al-Hujurat", arabicName: "الحجرات", totalAyat: 18, startPage: 515, endPage: 517, juzStart: 26 },
  { number: 50, name: "Qaf", arabicName: "ق", totalAyat: 45, startPage: 518, endPage: 520, juzStart: 26 },
  { number: 51, name: "Adz-Dzariyat", arabicName: "الذاريات", totalAyat: 60, startPage: 520, endPage: 523, juzStart: 26 },
  { number: 52, name: "Ath-Thur", arabicName: "الطور", totalAyat: 49, startPage: 523, endPage: 525, juzStart: 27 },
  { number: 53, name: "An-Najm", arabicName: "النجم", totalAyat: 62, startPage: 526, endPage: 528, juzStart: 27 },
  { number: 54, name: "Al-Qamar", arabicName: "القمر", totalAyat: 55, startPage: 528, endPage: 531, juzStart: 27 },
  { number: 55, name: "Ar-Rahman", arabicName: "الرحمن", totalAyat: 78, startPage: 531, endPage: 534, juzStart: 27 },
  { number: 56, name: "Al-Waqi'ah", arabicName: "الواقعة", totalAyat: 96, startPage: 534, endPage: 537, juzStart: 27 },
  { number: 57, name: "Al-Hadid", arabicName: "الحديد", totalAyat: 29, startPage: 537, endPage: 541, juzStart: 27 },
  { number: 58, name: "Al-Mujadilah", arabicName: "المجادلة", totalAyat: 22, startPage: 542, endPage: 545, juzStart: 28 },
  { number: 59, name: "Al-Hasyr", arabicName: "الحشر", totalAyat: 24, startPage: 545, endPage: 548, juzStart: 28 },
  { number: 60, name: "Al-Mumtahanah", arabicName: "الممتحنة", totalAyat: 13, startPage: 549, endPage: 551, juzStart: 28 },
  { number: 61, name: "Ash-Shaff", arabicName: "الصف", totalAyat: 14, startPage: 551, endPage: 552, juzStart: 28 },
  { number: 62, name: "Al-Jumu'ah", arabicName: "الجمعة", totalAyat: 11, startPage: 553, endPage: 554, juzStart: 28 },
  { number: 63, name: "Al-Munafiqun", arabicName: "المنافقون", totalAyat: 11, startPage: 554, endPage: 555, juzStart: 28 },
  { number: 64, name: "At-Taghabun", arabicName: "التغابن", totalAyat: 18, startPage: 556, endPage: 557, juzStart: 28 },
  { number: 65, name: "Ath-Thalaq", arabicName: "الطلاق", totalAyat: 12, startPage: 558, endPage: 560, juzStart: 28 },
  { number: 66, name: "At-Tahrim", arabicName: "التحريم", totalAyat: 12, startPage: 560, endPage: 561, juzStart: 28 },
  { number: 67, name: "Al-Mulk", arabicName: "الملك", totalAyat: 30, startPage: 562, endPage: 564, juzStart: 29 },
  { number: 68, name: "Al-Qalam", arabicName: "القلم", totalAyat: 52, startPage: 564, endPage: 566, juzStart: 29 },
  { number: 69, name: "Al-Haqqah", arabicName: "الحاقة", totalAyat: 52, startPage: 566, endPage: 568, juzStart: 29 },
  { number: 70, name: "Al-Ma'arij", arabicName: "المعارج", totalAyat: 44, startPage: 568, endPage: 570, juzStart: 29 },
  { number: 71, name: "Nuh", arabicName: "نوح", totalAyat: 28, startPage: 570, endPage: 571, juzStart: 29 },
  { number: 72, name: "Al-Jinn", arabicName: "الجن", totalAyat: 28, startPage: 572, endPage: 573, juzStart: 29 },
  { number: 73, name: "Al-Muzzammil", arabicName: "المزمل", totalAyat: 20, startPage: 574, endPage: 575, juzStart: 29 },
  { number: 74, name: "Al-Muddatstsir", arabicName: "المدثر", totalAyat: 56, startPage: 575, endPage: 577, juzStart: 29 },
  { number: 75, name: "Al-Qiyamah", arabicName: "القيامة", totalAyat: 40, startPage: 577, endPage: 578, juzStart: 29 },
  { number: 76, name: "Al-Insan", arabicName: "الإنسان", totalAyat: 31, startPage: 578, endPage: 580, juzStart: 29 },
  { number: 77, name: "Al-Mursalat", arabicName: "المرسلات", totalAyat: 50, startPage: 580, endPage: 581, juzStart: 29 },
  { number: 78, name: "An-Naba'", arabicName: "النبأ", totalAyat: 40, startPage: 582, endPage: 583, juzStart: 30 },
  { number: 79, name: "An-Nazi'at", arabicName: "النازعات", totalAyat: 46, startPage: 583, endPage: 584, juzStart: 30 },
  { number: 80, name: "'Abasa", arabicName: "عبس", totalAyat: 42, startPage: 585, endPage: 586, juzStart: 30 },
  { number: 81, name: "At-Takwir", arabicName: "التكوير", totalAyat: 29, startPage: 586, endPage: 586, juzStart: 30 },
  { number: 82, name: "Al-Infithar", arabicName: "الانفطار", totalAyat: 19, startPage: 587, endPage: 587, juzStart: 30 },
  { number: 83, name: "Al-Muthaffifin", arabicName: "المطففين", totalAyat: 36, startPage: 587, endPage: 589, juzStart: 30 },
  { number: 84, name: "Al-Insyiqaq", arabicName: "الانشقاق", totalAyat: 25, startPage: 589, endPage: 590, juzStart: 30 },
  { number: 85, name: "Al-Buruj", arabicName: "البروج", totalAyat: 22, startPage: 590, endPage: 590, juzStart: 30 },
  { number: 86, name: "Ath-Thariq", arabicName: "الطارق", totalAyat: 17, startPage: 591, endPage: 591, juzStart: 30 },
  { number: 87, name: "Al-A'la", arabicName: "الأعلى", totalAyat: 19, startPage: 591, endPage: 592, juzStart: 30 },
  { number: 88, name: "Al-Ghasyiyah", arabicName: "الغاشية", totalAyat: 26, startPage: 592, endPage: 593, juzStart: 30 },
  { number: 89, name: "Al-Fajr", arabicName: "الفجر", totalAyat: 30, startPage: 593, endPage: 594, juzStart: 30 },
  { number: 90, name: "Al-Balad", arabicName: "البلد", totalAyat: 20, startPage: 594, endPage: 595, juzStart: 30 },
  { number: 91, name: "Asy-Syams", arabicName: "الشمس", totalAyat: 15, startPage: 595, endPage: 595, juzStart: 30 },
  { number: 92, name: "Al-Lail", arabicName: "الليل", totalAyat: 21, startPage: 595, endPage: 596, juzStart: 30 },
  { number: 93, name: "Adh-Dhuha", arabicName: "الضحى", totalAyat: 11, startPage: 596, endPage: 596, juzStart: 30 },
  { number: 94, name: "Asy-Syarh", arabicName: "الشرح", totalAyat: 8, startPage: 596, endPage: 597, juzStart: 30 },
  { number: 95, name: "At-Tin", arabicName: "التين", totalAyat: 8, startPage: 597, endPage: 597, juzStart: 30 },
  { number: 96, name: "Al-'Alaq", arabicName: "العلق", totalAyat: 19, startPage: 597, endPage: 598, juzStart: 30 },
  { number: 97, name: "Al-Qadr", arabicName: "القدر", totalAyat: 5, startPage: 598, endPage: 598, juzStart: 30 },
  { number: 98, name: "Al-Bayyinah", arabicName: "البينة", totalAyat: 8, startPage: 598, endPage: 599, juzStart: 30 },
  { number: 99, name: "Az-Zalzalah", arabicName: "الزلزلة", totalAyat: 8, startPage: 599, endPage: 599, juzStart: 30 },
  { number: 100, name: "Al-'Adiyat", arabicName: "العاديات", totalAyat: 11, startPage: 599, endPage: 600, juzStart: 30 },
  { number: 101, name: "Al-Qari'ah", arabicName: "القارعة", totalAyat: 11, startPage: 600, endPage: 600, juzStart: 30 },
  { number: 102, name: "At-Takatsur", arabicName: "التكاثر", totalAyat: 8, startPage: 600, endPage: 600, juzStart: 30 },
  { number: 103, name: "Al-'Ashr", arabicName: "العصر", totalAyat: 3, startPage: 601, endPage: 601, juzStart: 30 },
  { number: 104, name: "Al-Humazah", arabicName: "الهمزة", totalAyat: 9, startPage: 601, endPage: 601, juzStart: 30 },
  { number: 105, name: "Al-Fil", arabicName: "الفيل", totalAyat: 5, startPage: 601, endPage: 601, juzStart: 30 },
  { number: 106, name: "Quraisy", arabicName: "قريش", totalAyat: 4, startPage: 602, endPage: 602, juzStart: 30 },
  { number: 107, name: "Al-Ma'un", arabicName: "الماعون", totalAyat: 7, startPage: 602, endPage: 602, juzStart: 30 },
  { number: 108, name: "Al-Kautsar", arabicName: "الكوثر", totalAyat: 3, startPage: 602, endPage: 602, juzStart: 30 },
  { number: 109, name: "Al-Kafirun", arabicName: "الكافرون", totalAyat: 6, startPage: 603, endPage: 603, juzStart: 30 },
  { number: 110, name: "An-Nashr", arabicName: "النصر", totalAyat: 3, startPage: 603, endPage: 603, juzStart: 30 },
  { number: 111, name: "Al-Lahab", arabicName: "اللهب", totalAyat: 5, startPage: 603, endPage: 603, juzStart: 30 },
  { number: 112, name: "Al-Ikhlas", arabicName: "الإخلاص", totalAyat: 4, startPage: 604, endPage: 604, juzStart: 30 },
  { number: 113, name: "Al-Falaq", arabicName: "الفلق", totalAyat: 5, startPage: 604, endPage: 604, juzStart: 30 },
  { number: 114, name: "An-Nas", arabicName: "الناس", totalAyat: 6, startPage: 604, endPage: 604, juzStart: 30 },
];

export const JUZ_LIST: JuzMeta[] = [
  { juz: 1, startPage: 1, endPage: 21, startSurah: "Al-Fatihah", startSurahNumber: 1, startAyat: 1, endSurah: "Al-Baqarah", endSurahNumber: 2, endAyat: 141, surahNumbers: [1, 2] },
  { juz: 2, startPage: 22, endPage: 41, startSurah: "Al-Baqarah", startSurahNumber: 2, startAyat: 142, endSurah: "Al-Baqarah", endSurahNumber: 2, endAyat: 252, surahNumbers: [2] },
  { juz: 3, startPage: 42, endPage: 61, startSurah: "Al-Baqarah", startSurahNumber: 2, startAyat: 253, endSurah: "Ali 'Imran", endSurahNumber: 3, endAyat: 92, surahNumbers: [2, 3] },
  { juz: 4, startPage: 62, endPage: 81, startSurah: "Ali 'Imran", startSurahNumber: 3, startAyat: 93, endSurah: "An-Nisa'", endSurahNumber: 4, endAyat: 23, surahNumbers: [3, 4] },
  { juz: 5, startPage: 82, endPage: 101, startSurah: "An-Nisa'", startSurahNumber: 4, startAyat: 24, endSurah: "An-Nisa'", endSurahNumber: 4, endAyat: 147, surahNumbers: [4] },
  { juz: 6, startPage: 102, endPage: 121, startSurah: "An-Nisa'", startSurahNumber: 4, startAyat: 148, endSurah: "Al-Ma'idah", endSurahNumber: 5, endAyat: 81, surahNumbers: [4, 5] },
  { juz: 7, startPage: 122, endPage: 141, startSurah: "Al-Ma'idah", startSurahNumber: 5, startAyat: 82, endSurah: "Al-An'am", endSurahNumber: 6, endAyat: 110, surahNumbers: [5, 6] },
  { juz: 8, startPage: 142, endPage: 161, startSurah: "Al-An'am", startSurahNumber: 6, startAyat: 111, endSurah: "Al-A'raf", endSurahNumber: 7, endAyat: 87, surahNumbers: [6, 7] },
  { juz: 9, startPage: 162, endPage: 181, startSurah: "Al-A'raf", startSurahNumber: 7, startAyat: 88, endSurah: "Al-Anfal", endSurahNumber: 8, endAyat: 40, surahNumbers: [7, 8] },
  { juz: 10, startPage: 182, endPage: 201, startSurah: "Al-Anfal", startSurahNumber: 8, startAyat: 41, endSurah: "At-Taubah", endSurahNumber: 9, endAyat: 92, surahNumbers: [8, 9] },
  { juz: 11, startPage: 202, endPage: 221, startSurah: "At-Taubah", startSurahNumber: 9, startAyat: 93, endSurah: "Hud", endSurahNumber: 11, endAyat: 5, surahNumbers: [9, 10, 11] },
  { juz: 12, startPage: 222, endPage: 241, startSurah: "Hud", startSurahNumber: 11, startAyat: 6, endSurah: "Yusuf", endSurahNumber: 12, endAyat: 52, surahNumbers: [11, 12] },
  { juz: 13, startPage: 242, endPage: 261, startSurah: "Yusuf", startSurahNumber: 12, startAyat: 53, endSurah: "Ibrahim", endSurahNumber: 14, endAyat: 52, surahNumbers: [12, 13, 14] },
  { juz: 14, startPage: 262, endPage: 281, startSurah: "Al-Hijr", startSurahNumber: 15, startAyat: 1, endSurah: "An-Nahl", endSurahNumber: 16, endAyat: 128, surahNumbers: [15, 16] },
  { juz: 15, startPage: 282, endPage: 301, startSurah: "Al-Isra'", startSurahNumber: 17, startAyat: 1, endSurah: "Al-Kahf", endSurahNumber: 18, endAyat: 74, surahNumbers: [17, 18] },
  { juz: 16, startPage: 302, endPage: 321, startSurah: "Al-Kahf", startSurahNumber: 18, startAyat: 75, endSurah: "Thaha", endSurahNumber: 20, endAyat: 135, surahNumbers: [18, 19, 20] },
  { juz: 17, startPage: 322, endPage: 341, startSurah: "Al-Anbiya'", startSurahNumber: 21, startAyat: 1, endSurah: "Al-Hajj", endSurahNumber: 22, endAyat: 78, surahNumbers: [21, 22] },
  { juz: 18, startPage: 342, endPage: 361, startSurah: "Al-Mu'minun", startSurahNumber: 23, startAyat: 1, endSurah: "Al-Furqan", endSurahNumber: 25, endAyat: 20, surahNumbers: [23, 24, 25] },
  { juz: 19, startPage: 362, endPage: 381, startSurah: "Al-Furqan", startSurahNumber: 25, startAyat: 21, endSurah: "An-Naml", endSurahNumber: 27, endAyat: 55, surahNumbers: [25, 26, 27] },
  { juz: 20, startPage: 382, endPage: 401, startSurah: "An-Naml", startSurahNumber: 27, startAyat: 56, endSurah: "Al-'Ankabut", endSurahNumber: 29, endAyat: 45, surahNumbers: [27, 28, 29] },
  { juz: 21, startPage: 402, endPage: 421, startSurah: "Al-'Ankabut", startSurahNumber: 29, startAyat: 46, endSurah: "Al-Ahzab", endSurahNumber: 33, endAyat: 30, surahNumbers: [29, 30, 31, 32, 33] },
  { juz: 22, startPage: 422, endPage: 441, startSurah: "Al-Ahzab", startSurahNumber: 33, startAyat: 31, endSurah: "Yasin", endSurahNumber: 36, endAyat: 27, surahNumbers: [33, 34, 35, 36] },
  { juz: 23, startPage: 442, endPage: 461, startSurah: "Yasin", startSurahNumber: 36, startAyat: 28, endSurah: "Az-Zumar", endSurahNumber: 39, endAyat: 31, surahNumbers: [36, 37, 38, 39] },
  { juz: 24, startPage: 462, endPage: 481, startSurah: "Az-Zumar", startSurahNumber: 39, startAyat: 32, endSurah: "Fushshilat", endSurahNumber: 41, endAyat: 46, surahNumbers: [39, 40, 41] },
  { juz: 25, startPage: 482, endPage: 501, startSurah: "Fushshilat", startSurahNumber: 41, startAyat: 47, endSurah: "Al-Jatsiyah", endSurahNumber: 45, endAyat: 37, surahNumbers: [41, 42, 43, 44, 45] },
  { juz: 26, startPage: 502, endPage: 521, startSurah: "Al-Ahqaf", startSurahNumber: 46, startAyat: 1, endSurah: "Adz-Dzariyat", endSurahNumber: 51, endAyat: 30, surahNumbers: [46, 47, 48, 49, 50, 51] },
  { juz: 27, startPage: 522, endPage: 541, startSurah: "Adz-Dzariyat", startSurahNumber: 51, startAyat: 31, endSurah: "Al-Hadid", endSurahNumber: 57, endAyat: 29, surahNumbers: [51, 52, 53, 54, 55, 56, 57] },
  { juz: 28, startPage: 542, endPage: 561, startSurah: "Al-Mujadilah", startSurahNumber: 58, startAyat: 1, endSurah: "At-Tahrim", endSurahNumber: 66, endAyat: 12, surahNumbers: [58, 59, 60, 61, 62, 63, 64, 65, 66] },
  { juz: 29, startPage: 562, endPage: 581, startSurah: "Al-Mulk", startSurahNumber: 67, startAyat: 1, endSurah: "Al-Mursalat", endSurahNumber: 77, endAyat: 50, surahNumbers: Array.from({ length: 11 }, (_, i) => 67 + i) },
  { juz: 30, startPage: 582, endPage: 604, startSurah: "An-Naba'", startSurahNumber: 78, startAyat: 1, endSurah: "An-Nas", endSurahNumber: 114, endAyat: 6, surahNumbers: Array.from({ length: 37 }, (_, i) => 78 + i) },
];

/**
 * Mengambil daftar surah yang berada di dalam suatu juz
 */
export function getSurahListByJuz(juzNumber: number): SurahMeta[] {
  const juzInfo = JUZ_LIST.find((j) => j.juz === juzNumber);
  if (!juzInfo) return [];
  return SURAH_LIST.filter((s) => juzInfo.surahNumbers.includes(s.number));
}

/**
 * Mendapatkan informasi juz berdasarkan nomor halaman Mushaf (1 - 604)
 */
export function getJuzByPage(page: number): number {
  const clampedPage = Math.max(1, Math.min(604, page));
  const found = JUZ_LIST.find((j) => clampedPage >= j.startPage && clampedPage <= j.endPage);
  return found ? found.juz : 1;
}

/**
 * Mengonversi halaman dalam juz (1 - 20) menjadi halaman absolut Mushaf Madinah (1 - 604)
 */
export function getAbsolutePage(juz: number, pageInput: number): number {
  const juzInfo = JUZ_LIST.find((j) => j.juz === juz);
  if (!juzInfo) return Math.max(1, Math.min(604, pageInput));

  // Jika input sudah merupakan nomor halaman Mushaf (lebih dari 20 atau berada di rentang juz)
  if (pageInput > 20 || (pageInput >= juzInfo.startPage && pageInput <= juzInfo.endPage)) {
    return Math.max(1, Math.min(604, pageInput));
  }

  // Jika berupa halaman relatif dalam juz (1 s.d. 20)
  const relative = Math.max(1, pageInput);
  const calculated = juzInfo.startPage + relative - 1;
  return Math.min(juzInfo.endPage, calculated);
}

/**
 * Algoritma Deteksi Pintar Surah Berdasarkan Juz, Halaman, dan Ayat
 */
export interface DetectionInput {
  juz?: number | string | null;
  halaman?: number | string | null;
  ayatMulai?: number | string | null;
  ayatSelesai?: number | string | null;
}

export interface DetectionResult {
  surahMulai: string;
  surahSelesai: string;
  detectedJuz: number;
  halamanMushaf: number;
  surahMulaiMeta: SurahMeta;
  surahSelesaiMeta: SurahMeta;
  availableSurahs: SurahMeta[];
  confidence: "exact" | "high" | "juz_default";
}

export function detectSurahByJuzPageVerse(input: DetectionInput): DetectionResult {
  const parsedJuz = input.juz ? Math.max(1, Math.min(30, Number(input.juz) || 1)) : 30;
  const juzInfo = JUZ_LIST.find((j) => j.juz === parsedJuz) || JUZ_LIST[29];
  const availableSurahs = getSurahListByJuz(juzInfo.juz);

  let targetPage: number = juzInfo.startPage;
  let hasPageInput = false;

  if (input.halaman !== undefined && input.halaman !== null && input.halaman !== "") {
    const rawPage = Number(input.halaman);
    if (!isNaN(rawPage) && rawPage > 0) {
      hasPageInput = true;
      targetPage = getAbsolutePage(juzInfo.juz, rawPage);
    }
  }

  // 1. Deteksi berdasarkan Halaman Mushaf
  if (hasPageInput) {
    // Cari surah yang mencakup halaman ini
    const surahsOnPage = availableSurahs.filter(
      (s) => targetPage >= s.startPage && targetPage <= s.endPage
    );

    if (surahsOnPage.length > 0) {
      let chosenStartSurah = surahsOnPage[0];

      // Jika ada surah yang baru MULAI di halaman ini, utamakan surah tersebut
      // (karena halaman tersebut menandai awal surah baru)
      const startingSurah = surahsOnPage.find((s) => s.startPage === targetPage);

      // Jika ada input ayatMulai, cocokkan dengan tepat
      if (input.ayatMulai !== undefined && input.ayatMulai !== null && input.ayatMulai !== "") {
        const ayatNum = Number(input.ayatMulai);
        if (!isNaN(ayatNum) && ayatNum > 0) {
          if (startingSurah && ayatNum <= startingSurah.totalAyat) {
            chosenStartSurah = startingSurah;
          } else {
            const matchedByAyat = surahsOnPage.find((s) => ayatNum <= s.totalAyat);
            if (matchedByAyat) chosenStartSurah = matchedByAyat;
          }
        }
      } else if (startingSurah) {
        chosenStartSurah = startingSurah;
      }

      let chosenEndSurah = chosenStartSurah;
      if (input.ayatSelesai !== undefined && input.ayatSelesai !== null && input.ayatSelesai !== "") {
        const ayatEndNum = Number(input.ayatSelesai);
        if (!isNaN(ayatEndNum) && ayatEndNum > 0) {
          const matchedEnd = surahsOnPage.find((s) => ayatEndNum <= s.totalAyat);
          if (matchedEnd) chosenEndSurah = matchedEnd;
        }
      }

      return {
        surahMulai: chosenStartSurah.name,
        surahSelesai: chosenEndSurah.name,
        detectedJuz: juzInfo.juz,
        halamanMushaf: targetPage,
        surahMulaiMeta: chosenStartSurah,
        surahSelesaiMeta: chosenEndSurah,
        availableSurahs,
        confidence: "exact",
      };
    }
  }

  // 2. Deteksi berdasarkan Ayat Mulai & Juz
  if (input.ayatMulai !== undefined && input.ayatMulai !== null && input.ayatMulai !== "") {
    const ayatNum = Number(input.ayatMulai);
    if (!isNaN(ayatNum) && ayatNum > 0) {
      // Jika surah awal juz dimulai dari ayat tertentu (contoh Juz 24 Az-Zumar ayat 32)
      if (ayatNum >= juzInfo.startAyat && juzInfo.startSurahNumber) {
        const startSurah = availableSurahs.find((s) => s.number === juzInfo.startSurahNumber);
        if (startSurah && ayatNum <= startSurah.totalAyat) {
          return {
            surahMulai: startSurah.name,
            surahSelesai: startSurah.name,
            detectedJuz: juzInfo.juz,
            halamanMushaf: targetPage,
            surahMulaiMeta: startSurah,
            surahSelesaiMeta: startSurah,
            availableSurahs,
            confidence: "high",
          };
        }
      }

      // Cari surah di dalam juz yang memiliki rentang ayat tersebut
      const matched = availableSurahs.find((s) => ayatNum <= s.totalAyat);
      if (matched) {
        return {
          surahMulai: matched.name,
          surahSelesai: matched.name,
          detectedJuz: juzInfo.juz,
          halamanMushaf: matched.startPage,
          surahMulaiMeta: matched,
          surahSelesaiMeta: matched,
          availableSurahs,
          confidence: "high",
        };
      }
    }
  }

  // 3. Fallback: Surah pertama dari Juz tersebut
  const defaultSurah = availableSurahs[0] || SURAH_LIST[0];
  return {
    surahMulai: defaultSurah.name,
    surahSelesai: defaultSurah.name,
    detectedJuz: juzInfo.juz,
    halamanMushaf: targetPage,
    surahMulaiMeta: defaultSurah,
    surahSelesaiMeta: defaultSurah,
    availableSurahs,
    confidence: "juz_default",
  };
}
