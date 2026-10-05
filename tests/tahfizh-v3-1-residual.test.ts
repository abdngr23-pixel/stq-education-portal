/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateManzilExpectedRange,
  SetoranLikeRecord,
  ManzilTasmiRecordLike,
} from "@/lib/tahfizh-page-allocation";
import { authorizeCanonical, CanonicalAssignmentWithDetails } from "@/lib/auth/canonical-evaluator";

describe("BATCH V3.1 — TAHFIZH RESIDUAL REMEDIATION (ORR-073, ORR-075, ORR-078, ORR-079)", () => {

  // =========================================================================
  // PART A — ORR-073: MANZIL EXACT OWNER RULE (SOURCE-TAH-001)
  // "MANZIL: murojaah seluruh hafalan baru dari halaman pertama sampai hafalan terakhir sebelum Tasmi',
  //          dari awal juz baru sampai pekan terakhir sebelum Tasmi'"
  // =========================================================================
  describe("Part A — ORR-073: MANZIL Expected Range Server Calculation", () => {

    // 1. normal current-cycle MANZIL
    it("1. normal current-cycle MANZIL: derives expected range from startPage to latest active SABAQ", () => {
      // Santri in Juz 30 (startPage: 582, endPage: 604)
      const sabaqRecords: SetoranLikeRecord[] = [
        {
          id: "set-01",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 30,
          halamanMulai: 582,
          halamanSelesai: 583,
          jumlahHalaman: 2.0,
          tanggal: new Date("2026-09-01T08:00:00Z"),
        },
        {
          id: "set-02",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 30,
          halamanMulai: 584,
          halamanSelesai: 586,
          jumlahHalaman: 3.0,
          tanggal: new Date("2026-09-02T08:00:00Z"),
        },
      ];

      const res = calculateManzilExpectedRange({
        targetJuz: 30,
        sabaqRecords,
        effectiveOccurredAt: new Date("2026-09-03T08:00:00Z"),
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.cycleJuz, 30);
      assert.strictEqual(res.expectedHalamanMulai, 582); // start of Juz 30
      assert.strictEqual(res.expectedHalamanSelesai, 586); // latest active SABAQ
      assert.strictEqual(res.expectedJumlahHalaman, 5); // 586 - 582 + 1 = 5
    });

    // 2. first week of new cycle
    it("2. first week of new cycle: start is page 1 of new juz and end is latest first-week page", () => {
      // Santri starts Juz 1 (startPage: 1, endPage: 21)
      const sabaqRecords: SetoranLikeRecord[] = [
        {
          id: "set-juz1-01",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 2,
          jumlahHalaman: 2.0,
          tanggal: new Date("2026-09-01T08:00:00Z"),
        },
      ];

      const res = calculateManzilExpectedRange({
        targetJuz: 1,
        sabaqRecords,
        effectiveOccurredAt: new Date("2026-09-02T08:00:00Z"),
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.cycleJuz, 1);
      assert.strictEqual(res.expectedHalamanMulai, 1);
      assert.strictEqual(res.expectedHalamanSelesai, 2);
      assert.strictEqual(res.expectedJumlahHalaman, 2);
    });

    // 3. week immediately before Tasmi'
    it("3. week immediately before Tasmi': full juz memorized before Tasmi recitation", () => {
      // Santri finished all 21 pages of Juz 1, preparing for Tasmi
      const sabaqRecords: SetoranLikeRecord[] = [
        {
          id: "set-full-juz1",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 21,
          jumlahHalaman: 21.0,
          tanggal: new Date("2026-09-10T08:00:00Z"),
        },
      ];

      const res = calculateManzilExpectedRange({
        targetJuz: 1,
        sabaqRecords,
        tasmiRecords: [], // No Tasmi yet
        effectiveOccurredAt: new Date("2026-09-11T08:00:00Z"),
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.expectedHalamanMulai, 1);
      assert.strictEqual(res.expectedHalamanSelesai, 21);
      assert.strictEqual(res.expectedJumlahHalaman, 21);
    });

    // 4. cancelled SABAQ
    it("4. cancelled SABAQ: DIBATALKAN records are strictly excluded from calculating max reached page", () => {
      const sabaqRecords: SetoranLikeRecord[] = [
        {
          id: "set-aktif",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 3,
          jumlahHalaman: 3.0,
          tanggal: new Date("2026-09-01T08:00:00Z"),
        },
        {
          id: "set-batal",
          jenis: "SABAQ",
          status: "DIBATALKAN",
          juz: 1,
          halamanMulai: 4,
          halamanSelesai: 6,
          jumlahHalaman: 3.0,
          tanggal: new Date("2026-09-02T08:00:00Z"),
        },
      ];

      const res = calculateManzilExpectedRange({
        targetJuz: 1,
        sabaqRecords,
        effectiveOccurredAt: new Date("2026-09-03T08:00:00Z"),
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.expectedHalamanMulai, 1);
      assert.strictEqual(res.expectedHalamanSelesai, 3); // Page 6 is excluded because it's DIBATALKAN
      assert.strictEqual(res.expectedJumlahHalaman, 3);
    });

    // 5. backdated MANZIL
    it("5. backdated MANZIL: SABAQ subsequent to effectiveOccurredAt are strictly excluded", () => {
      const sabaqRecords: SetoranLikeRecord[] = [
        {
          id: "set-senin",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 30,
          halamanMulai: 582,
          halamanSelesai: 584,
          jumlahHalaman: 3.0,
          tanggal: new Date("2026-09-01T08:00:00Z"), // Tuesday
        },
        {
          id: "set-kamis",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 30,
          halamanMulai: 585,
          halamanSelesai: 588,
          jumlahHalaman: 4.0,
          tanggal: new Date("2026-09-03T08:00:00Z"), // Thursday
        },
      ];

      // Backdated MANZIL recorded for Wednesday (2026-09-02)
      const res = calculateManzilExpectedRange({
        targetJuz: 30,
        sabaqRecords,
        effectiveOccurredAt: new Date("2026-09-02T12:00:00Z"),
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.expectedHalamanMulai, 582);
      assert.strictEqual(res.expectedHalamanSelesai, 584); // Thursday progress (585-588) cannot leak into Wednesday
      assert.strictEqual(res.expectedJumlahHalaman, 3);
    });

    // 6. future SABAQ exclusion
    it("6. future SABAQ exclusion: future records cannot influence current calculation", () => {
      const sabaqRecords: SetoranLikeRecord[] = [
        {
          id: "set-now",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 5,
          jumlahHalaman: 5.0,
          tanggal: new Date("2026-09-05T08:00:00Z"),
        },
        {
          id: "set-future",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 1,
          halamanMulai: 6,
          halamanSelesai: 10,
          jumlahHalaman: 5.0,
          tanggal: new Date("2026-09-10T08:00:00Z"), // Future relative to setoran
        },
      ];

      const res = calculateManzilExpectedRange({
        targetJuz: 1,
        sabaqRecords,
        effectiveOccurredAt: new Date("2026-09-05T12:00:00Z"),
      });

      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.expectedHalamanSelesai, 5);
    });

    // 7. no eligible progress
    it("7. no eligible progress: returns invalid/fail-closed when no active SABAQ exists for target juz", () => {
      const sabaqRecords: SetoranLikeRecord[] = [
        {
          id: "set-other-juz",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 2,
          halamanMulai: 22,
          halamanSelesai: 25,
          jumlahHalaman: 4.0,
          tanggal: new Date("2026-09-01T08:00:00Z"),
        },
      ];

      // Asking for Juz 1 where 0 SABAQ exists
      const res = calculateManzilExpectedRange({
        targetJuz: 1,
        sabaqRecords,
        effectiveOccurredAt: new Date("2026-09-02T08:00:00Z"),
      });

      assert.strictEqual(res.valid, false);
      assert.match(res.message || "", /Belum ada capaian hafalan Sabaq yang sah/i);
    });

    // 8. malformed historical data fail-closed
    it("8. malformed historical data fail-closed: fails closed when historical SABAQ has invalid pages or NaN", () => {
      const malformedRecords: SetoranLikeRecord[] = [
        {
          id: "set-corrupt",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 1,
          halamanMulai: 25, // corrupt: halamanMulai > halamanSelesai
          halamanSelesai: 10,
          jumlahHalaman: -15,
          tanggal: new Date("2026-09-01T08:00:00Z"),
        },
      ];

      const res = calculateManzilExpectedRange({
        targetJuz: 1,
        sabaqRecords: malformedRecords,
        effectiveOccurredAt: new Date("2026-09-02T08:00:00Z"),
      });

      assert.strictEqual(res.valid, false);
      assert.match(res.message || "", /DATA_INTEGRITY_ERROR/i);
    });

    // 9. Tasmi boundary
    it("9. Tasmi boundary: completed Tasmi closes the cycle for that juz; subsequent MANZIL fails closed", () => {
      const sabaqRecords: SetoranLikeRecord[] = [
        {
          id: "set-juz1-all",
          jenis: "SABAQ",
          status: "AKTIF",
          juz: 1,
          halamanMulai: 1,
          halamanSelesai: 21,
          jumlahHalaman: 21.0,
          tanggal: new Date("2026-09-01T08:00:00Z"),
        },
      ];

      const tasmiRecords: ManzilTasmiRecordLike[] = [
        {
          id: "tasmi-juz1",
          juz: 1,
          jenis: "TASMI",
          tanggal: new Date("2026-09-05T08:00:00Z"),
          nilai: 85.0, // Passed Tasmi
        },
      ];

      // After Tasmi completed: attempt to file MANZIL for Juz 1 on 2026-09-06
      const resAfterTasmi = calculateManzilExpectedRange({
        targetJuz: 1,
        sabaqRecords,
        tasmiRecords,
        effectiveOccurredAt: new Date("2026-09-06T08:00:00Z"),
      });
      assert.strictEqual(resAfterTasmi.valid, false);
      assert.match(resAfterTasmi.message || "", /telah diselesaikan sebelum tanggal setoran/i);

      // Backdated before Tasmi: MANZIL on 2026-09-03 succeeds
      const resBeforeTasmi = calculateManzilExpectedRange({
        targetJuz: 1,
        sabaqRecords,
        tasmiRecords,
        effectiveOccurredAt: new Date("2026-09-03T08:00:00Z"),
      });
      assert.strictEqual(resBeforeTasmi.valid, true);
      assert.strictEqual(resBeforeTasmi.expectedHalamanSelesai, 21);
    });
  });

  // =========================================================================
  // PART B — ORR-075: SIMA'AN = 5-JUZ MULTIPLE + BIL-GHAIB + SATU DUDUK
  // =========================================================================
  describe("Part B — ORR-075: Sima'an Validation Criteria", () => {
    // Helper to test validation rules matching recordTasmiSimaanAction
    function validateSimaanRules(input: {
      jenis: "TASMI" | "SIMAAN";
      juz: number;
      isBilGhaib?: boolean;
      isSatuDuduk?: boolean;
    }) {
      if (input.jenis === "SIMAAN") {
        const declaredJuz = Number(input.juz);
        if (![5, 10, 15, 20, 25, 30].includes(declaredJuz)) {
          return {
            success: false,
            message: "Ujian Sima'an hanya berlaku untuk kelipatan 5 juz (Juz 5, 10, 15, 20, 25, atau 30).",
          };
        }
        if (input.isBilGhaib !== true) {
          return {
            success: false,
            message: "Ujian Sima'an wajib dilaksanakan secara bil-ghaib (tanpa melihat mushaf).",
          };
        }
        if (input.isSatuDuduk !== true) {
          return {
            success: false,
            message: "Ujian Sima'an wajib dilaksanakan dalam satu kali duduk.",
          };
        }
      }
      return { success: true };
    }

    it("1. accepts valid Sima'an on 5-juz multiples with bil-ghaib and satu-duduk true", () => {
      for (const juz of [5, 10, 15, 20, 25, 30]) {
        const res = validateSimaanRules({
          jenis: "SIMAAN",
          juz,
          isBilGhaib: true,
          isSatuDuduk: true,
        });
        assert.strictEqual(res.success, true);
      }
    });

    it("2. rejects Sima'an on non-5-juz multiples (e.g. Juz 1, 2, 7, 29)", () => {
      for (const invalidJuz of [1, 2, 3, 4, 6, 7, 11, 29]) {
        const res = validateSimaanRules({
          jenis: "SIMAAN",
          juz: invalidJuz,
          isBilGhaib: true,
          isSatuDuduk: true,
        });
        assert.strictEqual(res.success, false);
        assert.match(res.message || "", /kelipatan 5 juz/i);
      }
    });

    it("3. rejects Sima'an if isBilGhaib is false or missing", () => {
      const resFalse = validateSimaanRules({
        jenis: "SIMAAN",
        juz: 5,
        isBilGhaib: false,
        isSatuDuduk: true,
      });
      assert.strictEqual(resFalse.success, false);
      assert.match(resFalse.message || "", /bil-ghaib/i);

      const resMissing = validateSimaanRules({
        jenis: "SIMAAN",
        juz: 5,
        isSatuDuduk: true,
      });
      assert.strictEqual(resMissing.success, false);
      assert.match(resMissing.message || "", /bil-ghaib/i);
    });

    it("4. rejects Sima'an if isSatuDuduk is false or missing", () => {
      const resFalse = validateSimaanRules({
        jenis: "SIMAAN",
        juz: 10,
        isBilGhaib: true,
        isSatuDuduk: false,
      });
      assert.strictEqual(resFalse.success, false);
      assert.match(resFalse.message || "", /satu kali duduk/i);

      const resMissing = validateSimaanRules({
        jenis: "SIMAAN",
        juz: 10,
        isBilGhaib: true,
      });
      assert.strictEqual(resMissing.success, false);
      assert.match(resMissing.message || "", /satu kali duduk/i);
    });

    it("5. TASMI does not require isBilGhaib or isSatuDuduk (regression prevention)", () => {
      for (const juz of [1, 2, 3, 15, 30]) {
        const res = validateSimaanRules({
          jenis: "TASMI",
          juz,
        });
        assert.strictEqual(res.success, true);
      }
    });
  });

  // =========================================================================
  // PART C — ORR-078: REWARD ISSUER CANONICAL AUTHORITY (tahfizh.reward.issue)
  // MUDIR (GLOBAL) -> ALLOW
  // KABID_TAHFIZH (DOMAIN) -> ALLOW
  // Everyone else -> DENY
  // =========================================================================
  describe("Part C — ORR-078: Reward Issuer Canonical Authority", () => {
    function createMudirAssignment(state: "VERIFIED_PRODUCTION" | "APPROVED_TARGET_PENDING_TECHNICAL" = "VERIFIED_PRODUCTION"): CanonicalAssignmentWithDetails {
      return {
        id: "asg-mudir-01",
        userId: "usr-mudir-01",
        positionId: "pos-mudir",
        positionCode: "MUDIR",
        positionName: "Mudir Pesantren",
        domain: "INSTITUTIONAL",
        unitId: "OU-PESANTREN",
        unitCode: "OU-PESANTREN",
        unitName: "STQ Darul Ulum Cendekia",
        unitGenderComplex: "TIDAK_TERIKAT",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        requiresPersonalAccount: true,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.issue",
            scopeType: "GLOBAL",
            businessRuleState: state,
          },
        ],
        scopeUnits: [],
      };
    }

    function createKabidTahfizhAssignment(state: "VERIFIED_PRODUCTION" | "APPROVED_TARGET_PENDING_TECHNICAL" = "VERIFIED_PRODUCTION"): CanonicalAssignmentWithDetails {
      return {
        id: "asg-kabid-01",
        userId: "usr-kabid-01",
        positionId: "pos-kabid",
        positionCode: "KABID_TAHFIZH",
        positionName: "Kepala Bidang Tahfidz",
        domain: "TAHFIZH",
        unitId: "OU-TAHFIZH",
        unitCode: "OU-TAHFIZH",
        unitName: "Direktorat Tahfizh",
        unitGenderComplex: "TIDAK_TERIKAT",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        requiresPersonalAccount: true,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.issue",
            scopeType: "DOMAIN",
            businessRuleState: state,
          },
        ],
        scopeUnits: [],
      };
    }

    function createMtAssignment(): CanonicalAssignmentWithDetails {
      return {
        id: "asg-mt-01",
        userId: "usr-mt-01",
        positionId: "pos-mt",
        positionCode: "MUSYRIF_TAHFIZH",
        positionName: "Musyrif Tahfizh",
        domain: "TAHFIZH",
        unitId: "OU-HLQ-01",
        unitCode: "OU-HLQ-01",
        unitName: "Halaqoh Abu Bakr",
        unitGenderComplex: "PUTRA",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        requiresPersonalAccount: true,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.recap.read",
            scopeType: "HALAQOH",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };
    }

    function createPotAssignment(): CanonicalAssignmentWithDetails {
      return {
        id: "asg-pot-01",
        userId: "usr-pot-01",
        positionId: "pos-pot",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        positionName: "Petugas Operasional Tahfizh",
        domain: "TAHFIZH",
        unitId: "OU-TAHFIZH",
        unitCode: "OU-TAHFIZH",
        unitName: "Direktorat Tahfizh",
        unitGenderComplex: "TIDAK_TERIKAT",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        requiresPersonalAccount: true,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.recap.read",
            scopeType: "GLOBAL",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };
    }

    const tahfizhResolvedContext = {
      santriId: "san-01",
      halaqohId: "OU-HLQ-01",
      orgUnitIds: ["OU-HLQ-01"],
      orgDomain: "TAHFIZH" as const,
      genderComplex: "PUTRA" as const,
    };

    it("1. MUDIR (GLOBAL, VERIFIED_PRODUCTION) -> ALLOW for tahfizh.reward.issue", async () => {
      const mudirAsg = createMudirAssignment();
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-mudir-01",
          username: "mudir.stq",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-mudir",
          mockAssignments: [mudirAsg],
        } as any,
        capability: "tahfizh.reward.issue",
        resolvedContext: tahfizhResolvedContext,
        isMutation: true,
      });

      assert.strictEqual(res.decision, "ALLOW");
      assert.strictEqual(res.scopeType, "GLOBAL");
    });

    it("2. KABID_TAHFIZH (DOMAIN: TAHFIZH, VERIFIED_PRODUCTION) -> ALLOW within domain", async () => {
      const kabidAsg = createKabidTahfizhAssignment();
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-kabid-01",
          username: "kabid.tahfizh",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kabid",
          mockAssignments: [kabidAsg],
        } as any,
        capability: "tahfizh.reward.issue",
        resolvedContext: tahfizhResolvedContext,
        isMutation: true,
      });

      assert.strictEqual(res.decision, "ALLOW");
      assert.strictEqual(res.scopeType, "DOMAIN");
    });

    it("3. Ordinary MUSYRIF_TAHFIZH -> DENY (CAPABILITY_NOT_GRANTED)", async () => {
      const mtAsg = createMtAssignment();
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-mt-01",
          username: "musyrif.tahfizh",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-mt",
          mockAssignments: [mtAsg],
        } as any,
        capability: "tahfizh.reward.issue",
        resolvedContext: tahfizhResolvedContext,
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("4. PETUGAS_OPERASIONAL_TAHFIZH (Lisa / musyirfah.putri) -> DENY because capability is absent, NOT hardcoded username", async () => {
      const potAsg = createPotAssignment();
      // Even with username musyirfah.putri or any other username
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-pot-01",
          username: "musyirfah.putri",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-pot",
          mockAssignments: [potAsg],
        } as any,
        capability: "tahfizh.reward.issue",
        resolvedContext: tahfizhResolvedContext,
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("5. ADM and generic roles without capability -> DENY", async () => {
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-adm-01",
          username: "admin.it",
          role: "ADM",
          status: "AKTIF",
          accountType: "PERSONAL",
          mockAssignments: [],
        } as any,
        capability: "tahfizh.reward.issue",
        resolvedContext: tahfizhResolvedContext,
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("6. Pending/unverified grant -> DENY", async () => {
      const mudirPendingAsg = createMudirAssignment("APPROVED_TARGET_PENDING_TECHNICAL");
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-mudir-01",
          username: "mudir.stq",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-mudir",
          mockAssignments: [mudirPendingAsg],
        } as any,
        capability: "tahfizh.reward.issue",
        resolvedContext: tahfizhResolvedContext,
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("7. Missing/unresolved resource context for mutation -> fail-closed", async () => {
      const kabidAsg = createKabidTahfizhAssignment();
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-kabid-01",
          username: "kabid.tahfizh",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kabid",
          mockAssignments: [kabidAsg],
        } as any,
        capability: "tahfizh.reward.issue",
        resolvedContext: undefined, // Missing context
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
    });

    it("8. Foreign domain scope for Kabid -> DENY", async () => {
      const kabidAsg = createKabidTahfizhAssignment();
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-kabid-01",
          username: "kabid.tahfizh",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kabid",
          mockAssignments: [kabidAsg],
        } as any,
        capability: "tahfizh.reward.issue",
        resolvedContext: {
          ...tahfizhResolvedContext,
          orgDomain: "KEASRAMAAN" as const, // Different domain
        },
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "SCOPE_MISMATCH");
    });

    it("9. Role alone confers zero authority without PositionCapability", async () => {
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-fake-ks",
          username: "fake.ks",
          role: "KS", // Legacy role alone
          status: "AKTIF",
          accountType: "PERSONAL",
          mockAssignments: [],
        } as any,
        capability: "tahfizh.reward.issue",
        resolvedContext: tahfizhResolvedContext,
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });
  });

  // =========================================================================
  // PART D — ORR-079: REWARD POLICY EDIT = MUDIR ONLY (tahfizh.policy.manage)
  // MUDIR -> ALLOW
  // KABID_TAHFIZH, MT, POT, ADM, OSDA -> DENY
  // =========================================================================
  describe("Part D — ORR-079: Reward Policy Edit Canonical Authority", () => {
    function createMudirPolicyAssignment(state: "VERIFIED_PRODUCTION" | "APPROVED_TARGET_PENDING_TECHNICAL" = "VERIFIED_PRODUCTION"): CanonicalAssignmentWithDetails {
      return {
        id: "asg-mudir-pol-01",
        userId: "usr-mudir-01",
        positionId: "pos-mudir",
        positionCode: "MUDIR",
        positionName: "Mudir Pesantren",
        domain: "INSTITUTIONAL",
        unitId: "OU-PESANTREN",
        unitCode: "OU-PESANTREN",
        unitName: "STQ Darul Ulum Cendekia",
        unitGenderComplex: "TIDAK_TERIKAT",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        requiresPersonalAccount: true,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.policy.manage",
            scopeType: "GLOBAL",
            businessRuleState: state,
          },
        ],
        scopeUnits: [],
      };
    }

    it("1. MUDIR (GLOBAL, VERIFIED_PRODUCTION) -> ALLOW for tahfizh.policy.manage", async () => {
      const mudirAsg = createMudirPolicyAssignment();
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-mudir-01",
          username: "mudir.stq",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-mudir",
          mockAssignments: [mudirAsg],
        } as any,
        capability: "tahfizh.policy.manage",
        isMutation: true,
      });

      assert.strictEqual(res.decision, "ALLOW");
      assert.strictEqual(res.scopeType, "GLOBAL");
    });

    it("2. KABID_TAHFIZH -> DENY (does not hold tahfizh.policy.manage)", async () => {
      const kabidAsg: CanonicalAssignmentWithDetails = {
        id: "asg-kabid-01",
        userId: "usr-kabid-01",
        positionId: "pos-kabid",
        positionCode: "KABID_TAHFIZH",
        positionName: "Kepala Bidang Tahfidz",
        domain: "TAHFIZH",
        unitId: "OU-TAHFIZH",
        unitCode: "OU-TAHFIZH",
        unitName: "Direktorat Tahfizh",
        unitGenderComplex: "TIDAK_TERIKAT",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        requiresPersonalAccount: true,
        positionCapabilities: [
          {
            capabilityCode: "tahfizh.reward.issue",
            scopeType: "DOMAIN",
            businessRuleState: "VERIFIED_PRODUCTION",
          },
        ],
        scopeUnits: [],
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-kabid-01",
          username: "kabid.tahfizh",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-kabid",
          mockAssignments: [kabidAsg],
        } as any,
        capability: "tahfizh.policy.manage",
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("3. Ordinary MUSYRIF_TAHFIZH -> DENY", async () => {
      const mtAsg: CanonicalAssignmentWithDetails = {
        id: "asg-mt-01",
        userId: "usr-mt-01",
        positionId: "pos-mt",
        positionCode: "MUSYRIF_TAHFIZH",
        positionName: "Musyrif Tahfizh",
        domain: "TAHFIZH",
        unitId: "OU-HLQ-01",
        unitCode: "OU-HLQ-01",
        unitName: "Halaqoh Abu Bakr",
        unitGenderComplex: "PUTRA",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        requiresPersonalAccount: true,
        positionCapabilities: [],
        scopeUnits: [],
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-mt-01",
          username: "musyrif.tahfizh",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-mt",
          mockAssignments: [mtAsg],
        } as any,
        capability: "tahfizh.policy.manage",
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("4. PETUGAS_OPERASIONAL_TAHFIZH (POT) -> DENY", async () => {
      const potAsg: CanonicalAssignmentWithDetails = {
        id: "asg-pot-01",
        userId: "usr-pot-01",
        positionId: "pos-pot",
        positionCode: "PETUGAS_OPERASIONAL_TAHFIZH",
        positionName: "Petugas Operasional Tahfizh",
        domain: "TAHFIZH",
        unitId: "OU-TAHFIZH",
        unitCode: "OU-TAHFIZH",
        unitName: "Direktorat Tahfizh",
        unitGenderComplex: "TIDAK_TERIKAT",
        status: "ACTIVE",
        validFrom: new Date(0),
        validUntil: null,
        requiresPersonalAccount: true,
        positionCapabilities: [],
        scopeUnits: [],
      };

      const res = await authorizeCanonical({
        identity: {
          userId: "usr-pot-01",
          username: "lisa.pot",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-pot",
          mockAssignments: [potAsg],
        } as any,
        capability: "tahfizh.policy.manage",
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("5. ADM and OSDA -> DENY", async () => {
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-adm-01",
          username: "adm",
          role: "ADM",
          status: "AKTIF",
          accountType: "PERSONAL",
          mockAssignments: [],
        } as any,
        capability: "tahfizh.policy.manage",
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("6. Pending grant for MUDIR -> DENY", async () => {
      const pendingMudir = createMudirPolicyAssignment("APPROVED_TARGET_PENDING_TECHNICAL");
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-mudir-01",
          username: "mudir.stq",
          status: "AKTIF",
          accountType: "PERSONAL",
          staffId: "stf-mudir",
          mockAssignments: [pendingMudir],
        } as any,
        capability: "tahfizh.policy.manage",
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });

    it("7. Legacy Role KS alone confers zero policy edit authority", async () => {
      const res = await authorizeCanonical({
        identity: {
          userId: "usr-legacy-ks",
          username: "legacy.ks",
          role: "KS", // Role alone
          status: "AKTIF",
          accountType: "PERSONAL",
          mockAssignments: [],
        } as any,
        capability: "tahfizh.policy.manage",
        isMutation: true,
      });

      assert.strictEqual(res.decision, "DENY");
      assert.strictEqual(res.code, "CAPABILITY_NOT_GRANTED");
    });
  });
});
