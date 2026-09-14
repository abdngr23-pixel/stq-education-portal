import { NilaiSetoran } from "@prisma/client";
import { z } from "zod";

/**
 * 1. PREDICATE ORDER & COMPARISON CONTRACT
 * Canonical semantic order:
 * DHOIF < MAQBUL < JAYYID < JAYYID_JIDDAN < MUMTAZ
 * Internal comparison ranks only (1-5).
 * IMPORTANT: Do NOT expose invented numeric scores (e.g. DHOIF=20, MUMTAZ=100).
 */
export const NILAI_SETORAN_ORDER: readonly NilaiSetoran[] = [
  "DHOIF",
  "MAQBUL",
  "JAYYID",
  "JAYYID_JIDDAN",
  "MUMTAZ",
] as const;

export const NILAI_SETORAN_RANK: Record<NilaiSetoran, number> = {
  DHOIF: 1,
  MAQBUL: 2,
  JAYYID: 3,
  JAYYID_JIDDAN: 4,
  MUMTAZ: 5,
};

export const VALID_NILAI_SETORAN_VALUES = Object.values(NilaiSetoran) as [
  NilaiSetoran,
  ...NilaiSetoran[]
];

export interface QualityDimensionsInput {
  tajwid: NilaiSetoran;
  fashahah: NilaiSetoran;
  kelancaran: NilaiSetoran;
}

/**
 * Derive the overall predicate from the three dimensions.
 * Canonical Rule: overall nilai = LOWEST (worst) of Tajwid, Fashahah, Kelancaran.
 */
export function deriveOverallNilai(input: QualityDimensionsInput): NilaiSetoran {
  const { tajwid, fashahah, kelancaran } = input;

  const rankTajwid = NILAI_SETORAN_RANK[tajwid] ?? 1;
  const rankFashahah = NILAI_SETORAN_RANK[fashahah] ?? 1;
  const rankKelancaran = NILAI_SETORAN_RANK[kelancaran] ?? 1;

  const minRank = Math.min(rankTajwid, rankFashahah, rankKelancaran);

  const matched = NILAI_SETORAN_ORDER.find(
    (n) => NILAI_SETORAN_RANK[n] === minRank
  );

  return matched || "DHOIF";
}

/**
 * 2. ERROR TAXONOMY CONTRACT
 * Exactly 8 canonical keys, all non-negative integers.
 */
export const CANONICAL_MISTAKE_KEYS = [
  "makhrajDanSifat",
  "mad",
  "ghunnahDanAhkamNunMim",
  "waqafIbtida",
  "harakatLafadz",
  "tawaqqufLupa",
  "tasyabuhAyat",
  "lainnya",
] as const;

export type CanonicalMistakeKey = (typeof CANONICAL_MISTAKE_KEYS)[number];

export type MistakeCounts = Record<CanonicalMistakeKey, number>;

export const DEFAULT_MISTAKE_COUNTS: MistakeCounts = {
  makhrajDanSifat: 0,
  mad: 0,
  ghunnahDanAhkamNunMim: 0,
  waqafIbtida: 0,
  harakatLafadz: 0,
  tawaqqufLupa: 0,
  tasyabuhAyat: 0,
  lainnya: 0,
};

export const mistakeCountsSchema = z
  .object({
    makhrajDanSifat: z.number().int({ message: "makhrajDanSifat harus bilangan bulat" }).min(0, { message: "makhrajDanSifat minimal 0" }),
    mad: z.number().int({ message: "mad harus bilangan bulat" }).min(0, { message: "mad minimal 0" }),
    ghunnahDanAhkamNunMim: z.number().int({ message: "ghunnahDanAhkamNunMim harus bilangan bulat" }).min(0, { message: "ghunnahDanAhkamNunMim minimal 0" }),
    waqafIbtida: z.number().int({ message: "waqafIbtida harus bilangan bulat" }).min(0, { message: "waqafIbtida minimal 0" }),
    harakatLafadz: z.number().int({ message: "harakatLafadz harus bilangan bulat" }).min(0, { message: "harakatLafadz minimal 0" }),
    tawaqqufLupa: z.number().int({ message: "tawaqqufLupa harus bilangan bulat" }).min(0, { message: "tawaqqufLupa minimal 0" }),
    tasyabuhAyat: z.number().int({ message: "tasyabuhAyat harus bilangan bulat" }).min(0, { message: "tasyabuhAyat minimal 0" }),
    lainnya: z.number().int({ message: "lainnya harus bilangan bulat" }).min(0, { message: "lainnya minimal 0" }),
  })
  .strict();

/**
 * 3. QUALITY TREND DIRECTION CONTRACT
 * Compares two evaluations categorically without synthetic percentage or weighted scores.
 */
export type QualityTrendDirection =
  | "MEMBAIK"
  | "STABIL"
  | "MENURUN"
  | "BELUM_CUKUP_DATA";

export function compareQualityDimension(
  prev: NilaiSetoran | null | undefined,
  curr: NilaiSetoran | null | undefined
): QualityTrendDirection {
  if (!prev || !curr) {
    return "BELUM_CUKUP_DATA";
  }

  const rankPrev = NILAI_SETORAN_RANK[prev];
  const rankCurr = NILAI_SETORAN_RANK[curr];

  if (!rankPrev || !rankCurr) {
    return "BELUM_CUKUP_DATA";
  }

  if (rankCurr > rankPrev) return "MEMBAIK";
  if (rankCurr < rankPrev) return "MENURUN";
  return "STABIL";
}

export interface DimensionTrendSummary {
  tajwid: QualityTrendDirection;
  fashahah: QualityTrendDirection;
  kelancaran: QualityTrendDirection;
  overall: QualityTrendDirection;
}

export function calculateQualityTrend(
  prev: {
    tajwid?: NilaiSetoran | null;
    fashahah?: NilaiSetoran | null;
    kelancaran?: NilaiSetoran | null;
    overall?: NilaiSetoran | null;
  } | null,
  curr: {
    tajwid?: NilaiSetoran | null;
    fashahah?: NilaiSetoran | null;
    kelancaran?: NilaiSetoran | null;
    overall?: NilaiSetoran | null;
  } | null
): DimensionTrendSummary {
  if (!prev || !curr) {
    return {
      tajwid: "BELUM_CUKUP_DATA",
      fashahah: "BELUM_CUKUP_DATA",
      kelancaran: "BELUM_CUKUP_DATA",
      overall: "BELUM_CUKUP_DATA",
    };
  }

  return {
    tajwid: compareQualityDimension(prev.tajwid, curr.tajwid),
    fashahah: compareQualityDimension(prev.fashahah, curr.fashahah),
    kelancaran: compareQualityDimension(prev.kelancaran, curr.kelancaran),
    overall: compareQualityDimension(prev.overall, curr.overall),
  };
}

/**
 * Human-friendly Indonesian labels for dimensions and taxonomy
 */
export const MISTAKE_LABELS: Record<CanonicalMistakeKey, { label: string; desc: string }> = {
  makhrajDanSifat: {
    label: "Makhraj & Sifat Huruf",
    desc: "Ketepatan makharijul huruf dan sifat (hams, jahr, isti'la, dll)",
  },
  mad: {
    label: "Ahkamul Mad",
    desc: "Kadar panjang mad thabi'i dan mad far'i (2, 4, 5, atau 6 harakat)",
  },
  ghunnahDanAhkamNunMim: {
    label: "Ghunnah & Ahkam Nun/Mim",
    desc: "Idgham, Ikhfa, Iqlab, Idzhar, ghunnah musyaddadah",
  },
  waqafIbtida: {
    label: "Waqaf & Ibtida'",
    desc: "Ketepatan tempat berhenti dan memulai kembali bacaan",
  },
  harakatLafadz: {
    label: "Harakat & Lafadz",
    desc: "Koreksi baris (fathah, kasrah, dhammah, sukun) atau lafadz ayat",
  },
  tawaqqufLupa: {
    label: "Tawaqquf (Lupa / Macet)",
    desc: "Terhenti atau membutuhkan bantuan bimbingan (talaqqi)",
  },
  tasyabuhAyat: {
    label: "Tasyabuh (Tertukar Ayat)",
    desc: "Tertukar dengan ayat serupa pada surah yang sama atau surah lain",
  },
  lainnya: {
    label: "Catatan Koreksi Lainnya",
    desc: "Koreksi tartil, waqaf qabih, atau kekeliruan lainnya",
  },
};

export const NILAI_LABELS: Record<NilaiSetoran, { label: string; short: string }> = {
  MUMTAZ: { label: "Mumtaz (Istimewa / Sangat Lancar)", short: "Mumtaz" },
  JAYYID_JIDDAN: { label: "Jayyid Jiddan (Baik Sekali)", short: "Jayyid Jiddan" },
  JAYYID: { label: "Jayyid (Baik)", short: "Jayyid" },
  MAQBUL: { label: "Maqbul (Cukup)", short: "Maqbul" },
  DHOIF: { label: "Dhoif (Perlu Mengulang)", short: "Dhoif" },
};
