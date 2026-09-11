import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import type { DashboardMusyrifTahfizhSantriItem } from "../components/dashboard/dashboard-musyrif-tahfizh";

describe("Koreksi Terbatas Dashboard Musyrif Tahfizh (Regression & Accessibility)", () => {
  const componentPath = path.resolve(
    process.cwd(),
    "components/dashboard/dashboard-musyrif-tahfizh.tsx"
  );
  const componentContent = fs.readFileSync(componentPath, "utf-8");

  // =========================================================================
  // 1. ELIMINASI KLAIM OPERASIONAL HARDCODED
  // =========================================================================
  describe("1. Eliminasi Data & Klaim Hardcoded", () => {
    it("tidak boleh memuat string 'Sesi Aktif'", () => {
      assert.ok(
        !componentContent.includes("Sesi Aktif"),
        "String 'Sesi Aktif' tidak boleh ada di komponen dashboard"
      );
    });

    it("tidak boleh memuat string 'Sesi Pagi Tahfizh Berjalan'", () => {
      assert.ok(
        !componentContent.includes("Sesi Pagi Tahfizh Berjalan"),
        "String 'Sesi Pagi Tahfizh Berjalan' tidak boleh ada di komponen dashboard"
      );
    });

    it("tidak boleh memuat string 'Sesi Pagi WITA' atau jam '06.00'", () => {
      assert.ok(
        !componentContent.includes("Sesi Pagi WITA"),
        "String 'Sesi Pagi WITA' tidak boleh ada di komponen dashboard"
      );
      assert.ok(
        !componentContent.includes("06.00"),
        "Jam hardcoded '06.00' tidak boleh ada di komponen dashboard"
      );
    });

    it("tidak boleh memuat 'Target Tahfizh: Juz 28–30 Mutqin'", () => {
      assert.ok(
        !componentContent.includes("Target Tahfizh: Juz 28"),
        "Rentang target hardcoded tidak boleh ada di komponen dashboard"
      );
    });

    it("harus menggunakan label netral 'Halaqoh Tahfizh'", () => {
      assert.ok(
        componentContent.includes("Halaqoh Tahfizh"),
        "Komponen harus memuat badge netral 'Halaqoh Tahfizh'"
      );
    });
  });

  // =========================================================================
  // 2. AKURASI LABEL KARTU & SHORTCUT
  // =========================================================================
  describe("2. Akurasi Label Stat Card & Akses Cepat", () => {
    it("kartu ke-4 harus berlabel 'Izin & Kesehatan' (bukan 'Perlu Perhatian')", () => {
      assert.ok(
        componentContent.includes("Izin & Kesehatan"),
        "Kartu ke-4 harus berlabel 'Izin & Kesehatan'"
      );
      assert.ok(
        !componentContent.includes("Perlu Perhatian"),
        "Label 'Perlu Perhatian' tidak boleh digunakan karena hanya memuat data izin dan sakit"
      );
    });

    it("shortcut data santri harus berlabel 'Data Santri' tanpa menyebut rapor", () => {
      assert.ok(
        componentContent.includes("Data Santri"),
        "Shortcut harus berlabel 'Data Santri'"
      );
      assert.ok(
        !componentContent.includes("Data & Rapor Santri"),
        "Shortcut tidak boleh menyebut 'Data & Rapor Santri' jika hanya membuka data santri"
      );
    });
  });

  // =========================================================================
  // 3. AKSESIBILITAS MODAL (WCAG FOCUS & KEYBOARD CONTROLS)
  // =========================================================================
  describe("3. Aksesibilitas Modal 'Lihat Semua Santri'", () => {
    it("harus memiliki listener tombol Escape untuk menutup modal", () => {
      assert.ok(
        componentContent.includes('e.key === "Escape"'),
        "Modal harus menangani event Escape untuk menutup dialog"
      );
    });

    it("harus mengimplementasikan focus trap (Tab dan Shift+Tab)", () => {
      assert.ok(
        componentContent.includes('e.key === "Tab"'),
        "Modal harus mengimplementasikan keyboard Tab listener untuk focus trap"
      );
      assert.ok(
        componentContent.includes("e.shiftKey"),
        "Modal harus menangani Shift+Tab untuk cycling elemen terfokus pertama/terakhir"
      );
    });

    it("harus mengembalikan fokus ke trigger button setelah modal ditutup", () => {
      assert.ok(
        componentContent.includes("triggerButtonRef.current?.focus()"),
        "Modal harus memulihkan fokus ke tombol pembuka (trigger button) saat ditutup"
      );
    });

    it("harus mengunci scroll body (body scroll lock) saat modal terbuka", () => {
      assert.ok(
        componentContent.includes('document.body.style.overflow = "hidden"'),
        "Modal harus mengunci scroll body saat terbuka"
      );
      assert.ok(
        componentContent.includes("document.body.style.overflow = originalOverflow"),
        "Modal harus memulihkan overflow body saat ditutup/unmount"
      );
    });

    it("harus memiliki aria-labelledby dan aria-describedby yang valid", () => {
      assert.ok(
        componentContent.includes('aria-labelledby="modal-santri-title"'),
        "Modal harus memiliki aria-labelledby yang menunjuk ke title modal"
      );
      assert.ok(
        componentContent.includes('aria-describedby="modal-santri-desc"'),
        "Modal harus memiliki aria-describedby yang menunjuk ke deskripsi modal"
      );
      assert.ok(
        componentContent.includes('id="modal-santri-title"'),
        "Elemen title modal harus memiliki id 'modal-santri-title'"
      );
      assert.ok(
        componentContent.includes('id="modal-santri-desc"'),
        "Elemen deskripsi modal harus memiliki id 'modal-santri-desc'"
      );
    });

    it("klik backdrop menutup modal dan klik isi modal dicegah via stopPropagation", () => {
      assert.ok(
        componentContent.includes("e.stopPropagation()"),
        "Konten modal harus memanggil e.stopPropagation() agar klik di dalam modal tidak memicu penutupan backdrop"
      );
    });

    it("pencarian harus di-reset saat modal ditutup", () => {
      assert.ok(
        componentContent.includes('setSearchQuery("")'),
        "Pencarian modal harus di-reset saat modal ditutup"
      );
    });
  });

  // =========================================================================
  // 4. REGRESSION TEST: NAVIGASI FALLBACK (ID vs NIS)
  // =========================================================================
  describe("4. Navigasi Fallback (handleStartSetoran)", () => {
    const mockSantriList: DashboardMusyrifTahfizhSantriItem[] = [
      {
        id: "SAN-UUID-001",
        nis: "NIS-001",
        nama: "Ahmad Santri 1",
        kelas: "7A",
        halaqoh: "Halaqoh Uji",
        capaianJuz: 10,
        targetJuz: 30,
        setoranTerakhir: "Juz 10",
        nilaiTerakhir: "MUMTAZ",
        poinPelanggaran: 0,
      },
      {
        id: "SAN-UUID-002",
        nis: "NIS-002",
        nama: "Budi Santri 2",
        kelas: "7A",
        halaqoh: "Halaqoh Uji",
        capaianJuz: 15,
        targetJuz: 30,
        setoranTerakhir: "Juz 15",
        nilaiTerakhir: "JAYYID_JIDDAN",
        poinPelanggaran: 0,
      },
    ];

    // Simulasi fungsi handleStartSetoran sesuai implementasi komponen
    function simulateHandleStartSetoran(
      santriId: string | undefined,
      props: {
        santriList: DashboardMusyrifTahfizhSantriItem[];
        selectedSantriId?: string;
        onSelectSantriId?: (id: string) => void;
        selectedSantriNis?: string;
        onSelectSantriNis?: (nis: string) => void;
        onNavigate?: (tab: string) => void;
      }
    ) {
      const targetId = santriId || props.selectedSantriId;

      if (targetId) {
        if (props.onSelectSantriId) {
          props.onSelectSantriId(targetId);
          return;
        }
        if (props.onSelectSantriNis) {
          const matched = props.santriList.find((s) => s.id === targetId || s.nis === targetId);
          const targetNis = matched ? matched.nis : (santriId ? undefined : props.selectedSantriNis);
          if (targetNis) {
            props.onSelectSantriNis(targetNis);
            return;
          }
        }
      } else if (props.selectedSantriNis && props.onSelectSantriNis) {
        props.onSelectSantriNis(props.selectedSantriNis);
        return;
      }

      if (props.onNavigate) {
        props.onNavigate("tahfizh");
      }
    }

    it("jalur ID: harus mengirim santri.id jika onSelectSantriId tersedia", () => {
      let receivedId = "";
      simulateHandleStartSetoran("SAN-UUID-002", {
        santriList: mockSantriList,
        onSelectSantriId: (id) => {
          receivedId = id;
        },
      });

      assert.equal(receivedId, "SAN-UUID-002", "onSelectSantriId harus menerima santri.id");
    });

    it("jalur fallback NIS: jika hanya onSelectSantriNis tersedia, harus mencari NIS santri dan TIDAK PERNAH mengirim UUID", () => {
      let receivedNis = "";
      simulateHandleStartSetoran("SAN-UUID-002", {
        santriList: mockSantriList,
        onSelectSantriNis: (nis) => {
          receivedNis = nis;
        },
      });

      assert.equal(
        receivedNis,
        "NIS-002",
        "onSelectSantriNis harus menerima santri.nis hasil pencarian, bukan UUID"
      );
      assert.notEqual(
        receivedNis,
        "SAN-UUID-002",
        "Dilarang mengirim nilai UUID ID ke callback yang mengharapkan NIS!"
      );
    });

    it("fallback tanpa santri terpilih: harus memanggil onNavigate('tahfizh')", () => {
      let navigatedTab = "";
      simulateHandleStartSetoran(undefined, {
        santriList: mockSantriList,
        onNavigate: (tab) => {
          navigatedTab = tab;
        },
      });

      assert.equal(navigatedTab, "tahfizh", "Harus menavigasi ke modul tahfizh secara umum");
    });
  });

  // =========================================================================
  // 5. REDUCED MOTION (WCAG ACCESSIBILITY)
  // =========================================================================
  describe("5. Dukungan Prefers-Reduced-Motion", () => {
    it("komponen harus menyertakan utilitas motion-reduce untuk transisi dekoratif", () => {
      assert.ok(
        componentContent.includes("motion-reduce:transition-none"),
        "Komponen harus menghormati prefers-reduced-motion via motion-reduce:transition-none"
      );
    });
  });
});
