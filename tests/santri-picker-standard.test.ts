import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  deriveAngkatan,
  formatSantriPickerLabel,
  matchesSantriSearch,
  sortSantriPickerList,
  SantriPickerItem,
} from "../lib/santri-picker";
import { catatPelanggaranAction } from "../app/actions/kedisiplinan";

describe("ORR-199 — Global Santri Picker UX Standard", () => {
  // =========================================================================
  // 1. ANGKATAN DERIVATION MAPPING
  // =========================================================================
  describe("1. Angkatan Derivation Mapping", () => {
    it("memetakan Kelas 9* -> 23 (9A, 9B, 9C, 9A Takhossus, Kelas 9A)", () => {
      assert.strictEqual(deriveAngkatan("9A"), "23");
      assert.strictEqual(deriveAngkatan("9B"), "23");
      assert.strictEqual(deriveAngkatan("9C"), "23");
      assert.strictEqual(deriveAngkatan("9A Takhossus"), "23");
      assert.strictEqual(deriveAngkatan("Kelas 9A"), "23");
      assert.strictEqual(deriveAngkatan("Kelas 9"), "23");
      assert.strictEqual(deriveAngkatan("9"), "23");
    });

    it("memetakan Kelas 8* -> 24 (8A, 8B, 8C, 8A Takhossus, Kelas 8B)", () => {
      assert.strictEqual(deriveAngkatan("8A"), "24");
      assert.strictEqual(deriveAngkatan("8B"), "24");
      assert.strictEqual(deriveAngkatan("8C"), "24");
      assert.strictEqual(deriveAngkatan("8A Takhossus"), "24");
      assert.strictEqual(deriveAngkatan("Kelas 8B"), "24");
      assert.strictEqual(deriveAngkatan("Kelas 8"), "24");
      assert.strictEqual(deriveAngkatan("8"), "24");
    });

    it("memetakan Kelas 7* -> 25 (7A, 7B, 7C, 7B Takhossus, Kelas 7C)", () => {
      assert.strictEqual(deriveAngkatan("7A"), "25");
      assert.strictEqual(deriveAngkatan("7B"), "25");
      assert.strictEqual(deriveAngkatan("7C"), "25");
      assert.strictEqual(deriveAngkatan("7B Takhossus"), "25");
      assert.strictEqual(deriveAngkatan("Kelas 7C"), "25");
      assert.strictEqual(deriveAngkatan("Kelas 7"), "25");
      assert.strictEqual(deriveAngkatan("7"), "25");
    });

    it("unknown class -> null (never invent angkatan)", () => {
      assert.strictEqual(deriveAngkatan(""), null);
      assert.strictEqual(deriveAngkatan(null), null);
      assert.strictEqual(deriveAngkatan(undefined), null);
      assert.strictEqual(deriveAngkatan("10A"), null);
      assert.strictEqual(deriveAngkatan("Alumni"), null);
      assert.strictEqual(deriveAngkatan("Khusus"), null);
    });
  });

  // =========================================================================
  // 2. PRIMARY DISPLAY LABEL STANDARD
  // =========================================================================
  describe("2. Primary Visible Label Standard", () => {
    it("primary visible label must contain only: <angkatan> - <nama>", () => {
      const s1: SantriPickerItem = {
        id: "s1",
        nama: "Obama Ozearld Egberted Turizqi",
        nis: "SAN-0001",
        kelas: "9A",
      };
      const s2: SantriPickerItem = {
        id: "s2",
        nama: "Muhammad Amirul Hanif Al-Fatih",
        nis: "SAN-0006",
        kelas: "8A",
      };
      const s3: SantriPickerItem = {
        id: "s3",
        nama: "Muh Fadhlilh Aksa",
        nis: "SAN-0017",
        kelas: "7B",
      };

      assert.strictEqual(
        formatSantriPickerLabel(s1),
        "23 - Obama Ozearld Egberted Turizqi"
      );
      assert.strictEqual(
        formatSantriPickerLabel(s2),
        "24 - Muhammad Amirul Hanif Al-Fatih"
      );
      assert.strictEqual(
        formatSantriPickerLabel(s3),
        "25 - Muh Fadhlilh Aksa"
      );
    });

    it("unknown class -> show nama only, never invent angkatan", () => {
      const sUnknown: SantriPickerItem = {
        id: "s4",
        nama: "Santri Jalur Khusus",
        nis: "SAN-9999",
        kelas: null,
      };
      assert.strictEqual(
        formatSantriPickerLabel(sUnknown),
        "Santri Jalur Khusus"
      );

      const sAlumni: SantriPickerItem = {
        id: "s5",
        nama: "Ahmad Alumni",
        nis: "SAN-9998",
        kelas: "Alumni",
      };
      assert.strictEqual(formatSantriPickerLabel(sAlumni), "Ahmad Alumni");
    });
  });

  // =========================================================================
  // 3. DUPLICATE ANGKATAN + NAMA DISAMBIGUATION
  // =========================================================================
  describe("3. Duplicate Same Angkatan + Nama Disambiguation", () => {
    it("menggunakan metadata sekunder hanya jika terjadi duplikasi angkatan dan nama", () => {
      const list: SantriPickerItem[] = [
        {
          id: "s10",
          nama: "Ahmad Fauzi",
          nis: "SAN-0101",
          kelas: "9A",
        },
        {
          id: "s11",
          nama: "Ahmad Fauzi",
          nis: "SAN-0102",
          kelas: "9B",
        },
        {
          id: "s12",
          nama: "Obama Ozearld Egberted Turizqi",
          nis: "SAN-0001",
          kelas: "9A",
        },
      ];

      // Ahmad Fauzi memiliki duplikat di angkatan 23 (kelas 9A dan 9B)
      assert.strictEqual(
        formatSantriPickerLabel(list[0], list),
        "23 - Ahmad Fauzi (9A)"
      );
      assert.strictEqual(
        formatSantriPickerLabel(list[1], list),
        "23 - Ahmad Fauzi (9B)"
      );

      // Obama tidak memiliki duplikat, label tetap bersih tanpa secondary metadata
      assert.strictEqual(
        formatSantriPickerLabel(list[2], list),
        "23 - Obama Ozearld Egberted Turizqi"
      );
    });

    it("menambahkan NIS jika kelas juga identik pada duplikasi", () => {
      const listIdenticalClass: SantriPickerItem[] = [
        {
          id: "s20",
          nama: "Muhammad Rizky",
          nis: "SAN-0201",
          kelas: "8A",
        },
        {
          id: "s21",
          nama: "Muhammad Rizky",
          nis: "SAN-0202",
          kelas: "8A",
        },
      ];

      assert.strictEqual(
        formatSantriPickerLabel(listIdenticalClass[0], listIdenticalClass),
        "24 - Muhammad Rizky (8A - SAN-0201)"
      );
      assert.strictEqual(
        formatSantriPickerLabel(listIdenticalClass[1], listIdenticalClass),
        "24 - Muhammad Rizky (8A - SAN-0202)"
      );
    });
  });

  // =========================================================================
  // 4. MULTI-ATTRIBUTE SEARCH
  // =========================================================================
  describe("4. Multi-Attribute Search Matching", () => {
    const sampleSantri: SantriPickerItem = {
      id: "san_01",
      nama: "Obama Ozearld Egberted Turizqi",
      nis: "SAN-0001",
      kelas: "9A Takhossus",
      halaqohNama: "Halaqoh Ust. Razan Mufli, S.Pd",
    };

    it("search by nama (case-insensitive & partial match)", () => {
      assert.strictEqual(matchesSantriSearch(sampleSantri, "Obama"), true);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "ozearld"), true);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "Turizqi"), true);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "Zaid"), false);
    });

    it("search by 23/24/25 angkatan", () => {
      assert.strictEqual(matchesSantriSearch(sampleSantri, "23"), true);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "24"), false);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "25"), false);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "23 - Obama"), true);
    });

    it("search by class", () => {
      assert.strictEqual(matchesSantriSearch(sampleSantri, "9A"), true);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "Takhossus"), true);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "8A"), false);
    });

    it("search by NIS / SAN code", () => {
      assert.strictEqual(matchesSantriSearch(sampleSantri, "SAN-0001"), true);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "0001"), true);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "SAN-0002"), false);
    });

    it("search by halaqoh where available", () => {
      assert.strictEqual(matchesSantriSearch(sampleSantri, "Razan"), true);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "Mufli"), true);
      assert.strictEqual(matchesSantriSearch(sampleSantri, "Kamal"), false);
    });
  });

  // =========================================================================
  // 5. SORTING STANDARD (23 -> 24 -> 25 -> UNKNOWN, THEN NAMA A-Z)
  // =========================================================================
  describe("5. Sorting Standard", () => {
    it("mengurutkan 23 -> 24 -> 25, lalu unknown class, kemudian nama A-Z", () => {
      const unsorted: SantriPickerItem[] = [
        { id: "1", nama: "Zulkifli", nis: "01", kelas: "7B" }, // 25
        { id: "2", nama: "Amirul", nis: "02", kelas: "8A" },   // 24
        { id: "3", nama: "Obama", nis: "03", kelas: "9A" },    // 23
        { id: "4", nama: "Budi", nis: "04", kelas: "9B" },     // 23
        { id: "5", nama: "Aksa", nis: "05", kelas: "7A" },     // 25
        { id: "6", nama: "Badar", nis: "06", kelas: "8B" },    // 24
        { id: "7", nama: "Alumni Santri", nis: "07", kelas: null }, // Unknown
      ];

      const sorted = sortSantriPickerList(unsorted);

      // Angkatan 23 group (Budi, Obama)
      assert.strictEqual(sorted[0].nama, "Budi");
      assert.strictEqual(deriveAngkatan(sorted[0].kelas), "23");
      assert.strictEqual(sorted[1].nama, "Obama");
      assert.strictEqual(deriveAngkatan(sorted[1].kelas), "23");

      // Angkatan 24 group (Amirul, Badar)
      assert.strictEqual(sorted[2].nama, "Amirul");
      assert.strictEqual(deriveAngkatan(sorted[2].kelas), "24");
      assert.strictEqual(sorted[3].nama, "Badar");
      assert.strictEqual(deriveAngkatan(sorted[3].kelas), "24");

      // Angkatan 25 group (Aksa, Zulkifli)
      assert.strictEqual(sorted[4].nama, "Aksa");
      assert.strictEqual(deriveAngkatan(sorted[4].kelas), "25");
      assert.strictEqual(sorted[5].nama, "Zulkifli");
      assert.strictEqual(deriveAngkatan(sorted[5].kelas), "25");

      // Unknown class group at the end
      assert.strictEqual(sorted[6].nama, "Alumni Santri");
      assert.strictEqual(deriveAngkatan(sorted[6].kelas), null);
    });
  });

  // =========================================================================
  // 6. SELECTED LABEL = DROPDOWN LABEL
  // =========================================================================
  describe("6. Selected Label Equals Dropdown Label", () => {
    it("label pilihan terpilih harus identik dengan label opsi dropdown", () => {
      const items: SantriPickerItem[] = [
        { id: "s1", nama: "Obama Ozearld Egberted Turizqi", nis: "SAN-0001", kelas: "9A" },
        { id: "s2", nama: "Muhammad Amirul Hanif Al-Fatih", nis: "SAN-0006", kelas: "8A" },
      ];

      const sorted = sortSantriPickerList(items);

      for (const item of sorted) {
        const dropdownOptionLabel = formatSantriPickerLabel(item, sorted);
        const selectedValue = item.id;
        const selectedFound = sorted.find((s) => s.id === selectedValue);
        const selectedLabel = selectedFound ? formatSantriPickerLabel(selectedFound, sorted) : "";

        assert.strictEqual(
          selectedLabel,
          dropdownOptionLabel,
          `Selected label untuk ${item.nama} harus sama persis dengan dropdown option label`
        );
      }
    });
  });

  // =========================================================================
  // 7. CONTRACT & SCOPE AUDIT OF AUDITED MODULES
  // =========================================================================
  describe("7. Contract & Scope Audit in Module Files", () => {
    const tahfizhPath = path.resolve(process.cwd(), "components/modules/tahfizh-module.tsx");
    const akademikPath = path.resolve(process.cwd(), "components/modules/akademik-module.tsx");
    const perizinanPath = path.resolve(process.cwd(), "components/modules/perizinan-module.tsx");
    const kesehatanPath = path.resolve(process.cwd(), "components/modules/kesehatan-module.tsx");
    const kedisiplinanPath = path.resolve(process.cwd(), "components/modules/kedisiplinan-module.tsx");

    const tahfizhCode = fs.readFileSync(tahfizhPath, "utf-8");
    const akademikCode = fs.readFileSync(akademikPath, "utf-8");
    const perizinanCode = fs.readFileSync(perizinanPath, "utf-8");
    const kesehatanCode = fs.readFileSync(kesehatanPath, "utf-8");
    const kedisiplinanCode = fs.readFileSync(kedisiplinanPath, "utf-8");

    it("Tahfizh Setoran Harian menggunakan SantriPicker dengan id santri-selector dan scoped list", () => {
      assert.ok(
        tahfizhCode.includes('import { SantriPicker } from "@/components/ui/santri-picker";'),
        "tahfizh-module.tsx harus mengimpor SantriPicker"
      );
      assert.ok(
        tahfizhCode.includes('id="santri-selector"'),
        "Tahfizh Setoran picker harus mempertahankan id santri-selector"
      );
      assert.ok(
        tahfizhCode.includes("items={setoranSantriList}"),
        "Tahfizh Setoran picker harus mempertahankan scoped setoranSantriList"
      );
      assert.ok(
        tahfizhCode.includes('valueKey="id"'),
        "Tahfizh Setoran picker harus mempertahankan value contract 'id'"
      );
    });

    it("Tahfizh Ujian Ikhtibar menggunakan SantriPicker dengan valueKey nis", () => {
      assert.ok(
        tahfizhCode.includes("value={ajukanSantriNis}"),
        "Tahfizh Ikhtibar picker harus mempertahankan binding ajukanSantriNis"
      );
      assert.ok(
        tahfizhCode.includes('valueKey="nis"'),
        "Tahfizh Ikhtibar picker harus mempertahankan value contract 'nis'"
      );
    });

    it("Akademik Input Nilai & Rapor menggunakan SantriPicker", () => {
      assert.ok(
        akademikCode.includes('import { SantriPicker } from "@/components/ui/santri-picker";'),
        "akademik-module.tsx harus mengimpor SantriPicker"
      );
      assert.ok(
        akademikCode.includes('data-testid="select-santri-rapor"'),
        "Akademik Rapor picker harus mempertahankan data-testid select-santri-rapor"
      );
      assert.ok(
        akademikCode.includes("items={filteredSantriOptions}"),
        "Akademik Input Nilai picker harus mempertahankan filteredSantriOptions"
      );
    });

    it("Perizinan menggunakan SantriPicker dengan valueKey nis", () => {
      assert.ok(
        perizinanCode.includes('import { SantriPicker } from "@/components/ui/santri-picker";'),
        "perizinan-module.tsx harus mengimpor SantriPicker"
      );
      assert.ok(
        perizinanCode.includes("value={selectedSantriNis}"),
        "Perizinan picker harus mempertahankan binding selectedSantriNis"
      );
      assert.ok(
        perizinanCode.includes('valueKey="nis"'),
        "Perizinan picker harus mempertahankan valueKey 'nis'"
      );
    });

    it("Kesehatan menggunakan SantriPicker dengan valueKey nis", () => {
      assert.ok(
        kesehatanCode.includes('import { SantriPicker } from "@/components/ui/santri-picker";'),
        "kesehatan-module.tsx harus mengimpor SantriPicker"
      );
      assert.ok(
        kesehatanCode.includes("value={selectedSantriNis}"),
        "Kesehatan picker harus mempertahankan binding selectedSantriNis"
      );
      assert.ok(
        kesehatanCode.includes('valueKey="nis"'),
        "Kesehatan picker harus mempertahankan valueKey 'nis'"
      );
    });

    it("Kedisiplinan UI dinormalisasi namun mutasi tetap terkunci (POLICY_NOT_ACTIVE)", async () => {
      assert.ok(
        kedisiplinanCode.includes('import { SantriPicker } from "@/components/ui/santri-picker";'),
        "kedisiplinan-module.tsx harus mengimpor SantriPicker"
      );
      assert.ok(
        kedisiplinanCode.includes('valueKey="id"'),
        "Kedisiplinan picker harus mempertahankan valueKey 'id'"
      );

      // Memastikan mutation server action kedisiplinan tetap terkunci (POLICY_NOT_ACTIVE)
      const res = await catatPelanggaranAction({
        santriId: "santri_dummy",
        kategoriId: "kat_dummy",
        kronologi: "Pengujian mutasi terkunci",
      });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.errorCode, "POLICY_NOT_ACTIVE");
    });
  });
});
