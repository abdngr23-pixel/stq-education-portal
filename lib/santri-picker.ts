/**
 * ORR-199 — GLOBAL SANTRI PICKER UX STANDARD
 * Centralized helpers for angkatan derivation, display label formatting,
 * multi-attribute search matching, and deterministic sorting.
 */

export interface SantriPickerItem {
  id: string;
  nama: string;
  nis: string;
  kelas?: string | null;
  halaqoh?: string | null;
  halaqohNama?: string | null;
  kamar?: string | null;
  poinPelanggaran?: number;
}

/**
 * Derives angkatan code from santri's class name.
 * Mapping standard:
 * - Kelas 9* -> "23"
 * - Kelas 8* -> "24"
 * - Kelas 7* -> "25"
 * Unknown / other classes return null (never invent angkatan).
 */
export function deriveAngkatan(kelas?: string | null): string | null {
  if (!kelas || typeof kelas !== "string") return null;
  const trimmed = kelas.trim();
  if (!trimmed) return null;

  // Match optional prefix "kelas" / "kls" followed by optional spaces/dots,
  // then check if the leading grade digit is 9, 8, or 7.
  const match = trimmed.match(/^(?:kelas\s*|kls\.?\s*)?([789])(?:\b|[^\d]|$)/i);
  if (match) {
    const digit = match[1];
    if (digit === "9") return "23";
    if (digit === "8") return "24";
    if (digit === "7") return "25";
  }
  return null;
}

/**
 * Returns sort priority rank for angkatan.
 * 23 -> rank 1
 * 24 -> rank 2
 * 25 -> rank 3
 * other known -> 10+
 * unknown (null) -> 999 (sorted at the end)
 */
export function getAngkatanSortRank(angkatan: string | null): number {
  if (angkatan === "23") return 1;
  if (angkatan === "24") return 2;
  if (angkatan === "25") return 3;
  if (angkatan !== null) {
    const num = parseInt(angkatan, 10);
    return isNaN(num) ? 99 : 10 + num;
  }
  return 999;
}

/**
 * Deterministically sorts a list of santri according to ORR-199:
 * 23 -> 24 -> 25 -> unknown class, then nama A-Z.
 */
export function sortSantriPickerList<T extends SantriPickerItem>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const angkatanA = deriveAngkatan(a.kelas);
    const angkatanB = deriveAngkatan(b.kelas);
    const rankA = getAngkatanSortRank(angkatanA);
    const rankB = getAngkatanSortRank(angkatanB);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const nameDiff = a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
    if (nameDiff !== 0) return nameDiff;

    return (a.nis || "").localeCompare(b.nis || "", "id");
  });
}

/**
 * Formats primary visible label for Santri picker:
 * Standard: "<angkatan> - <nama>"
 * Unknown class: "<nama>"
 * Duplicate same angkatan + nama: appends secondary metadata only for disambiguation.
 */
export function formatSantriPickerLabel(
  santri: SantriPickerItem,
  context?: { isDuplicate?: boolean } | SantriPickerItem[]
): string {
  const angkatan = deriveAngkatan(santri.kelas);
  const baseLabel = angkatan ? `${angkatan} - ${santri.nama}` : santri.nama;

  let isDuplicate = false;
  let hasSameClass = false;

  if (Array.isArray(context)) {
    const duplicates = context.filter(
      (other) =>
        (other.id !== santri.id || other.nis !== santri.nis) &&
        deriveAngkatan(other.kelas) === angkatan &&
        other.nama.trim().toLowerCase() === santri.nama.trim().toLowerCase()
    );
    if (duplicates.length > 0) {
      isDuplicate = true;
      hasSameClass = duplicates.some(
        (other) =>
          (other.kelas || "").trim().toLowerCase() ===
          (santri.kelas || "").trim().toLowerCase()
      );
    }
  } else if (context && typeof context === "object") {
    isDuplicate = !!context.isDuplicate;
  }

  if (isDuplicate) {
    if (santri.kelas && !hasSameClass) {
      return `${baseLabel} (${santri.kelas})`;
    }
    if (santri.kelas && santri.nis) {
      return `${baseLabel} (${santri.kelas} - ${santri.nis})`;
    }
    if (santri.nis) {
      return `${baseLabel} (${santri.nis})`;
    }
  }

  return baseLabel;
}

/**
 * Validates if a santri matches the search query.
 * Matches:
 * - nama
 * - angkatan (e.g. 23, 24, 25)
 * - kelas (e.g. 9A, 8B, 7C, 9, 8, 7)
 * - NIS / SAN code (e.g. SAN-0001)
 * - halaqoh where already available/relevant
 */
export function matchesSantriSearch(santri: SantriPickerItem, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  // Match nama
  if (santri.nama && santri.nama.toLowerCase().includes(q)) return true;

  // Match angkatan
  const angkatan = deriveAngkatan(santri.kelas);
  if (angkatan) {
    if (angkatan.toLowerCase().includes(q)) return true;
    if (`${angkatan} - ${santri.nama}`.toLowerCase().includes(q)) return true;
  }

  // Match kelas
  if (santri.kelas && santri.kelas.toLowerCase().includes(q)) return true;

  // Match NIS
  if (santri.nis && santri.nis.toLowerCase().includes(q)) return true;

  // Match halaqoh
  if (santri.halaqoh && santri.halaqoh.toLowerCase().includes(q)) return true;
  if (santri.halaqohNama && santri.halaqohNama.toLowerCase().includes(q)) return true;

  return false;
}
