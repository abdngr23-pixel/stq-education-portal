import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { GenderComplex } from "@/types/architecture-lock";

export interface HalaqohOrgUnitMapping {
  halaqohId: string;
  halaqohCode: string;
  halaqohName: string;
  orgUnitId: string;
  orgUnitCode: string;
  genderComplex: GenderComplex;
}

export class HalaqohMappingError extends Error {
  public readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "HalaqohMappingError";
    this.code = code;
  }
}

/**
 * Authoritative Mapping Bridge: Halaqoh <-> Canonical OrgUnit
 * Resolves the structural ID namespace difference:
 * - Santri.halaqohId references Halaqoh.id
 * - Assignment.unitId references OrgUnit.id
 *
 * Source of truth:
 * Halaqoh.halaqohCode -> canonical OrgUnit code = "OU-" + halaqohCode -> canonical active OrgUnit.id
 * (or matching canonical OrgUnit with type=HALAQOH, domain=TAHFIZH)
 *
 * Requirements:
 * 1. resolveResourceContext for Tahfizh must produce a canonical OrgUnit Halaqoh identity usable by the scope evaluator.
 * 2. Scope evaluator HALAQOH must compare canonical-equivalent identifiers, not IDs from unrelated tables.
 * 3. Runtime query filtering must translate canonical allowed OrgUnit scopes back to the authoritative Halaqoh IDs needed by Santri.halaqohId.
 * 4. Missing mapping = FAIL CLOSED.
 * 5. Duplicate/ambiguous mapping = FAIL CLOSED.
 * 6. Inactive source Halaqoh or inactive canonical OrgUnit = FAIL CLOSED.
 * 7. Database query failure != empty result (throws or returns error).
 */

export async function resolveCanonicalOrgUnitForHalaqoh(
  halaqohIdOrCode: string,
  db: PrismaClient = defaultPrisma
): Promise<HalaqohOrgUnitMapping | null> {
  if (!halaqohIdOrCode || typeof halaqohIdOrCode !== "string") {
    return null;
  }

  const partialDb = db as unknown as {
    halaqoh?: { findMany?: unknown };
    orgUnit?: { findMany?: unknown };
  };
  if (
    !db ||
    typeof partialDb.halaqoh?.findMany !== "function" ||
    typeof partialDb.orgUnit?.findMany !== "function"
  ) {
    return null;
  }

  // 1. Fetch source Halaqoh
  let halaqohList: Array<{
    id: string;
    halaqohCode: string;
    nama: string;
    status: string;
  }>;
  try {
    halaqohList = await db.halaqoh.findMany({
      where: {
        OR: [
          { id: halaqohIdOrCode },
          { halaqohCode: halaqohIdOrCode },
        ],
      },
      select: {
        id: true,
        halaqohCode: true,
        nama: true,
        status: true,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HalaqohMappingError(
      `Database error querying halaqoh for mapping: ${msg}`,
      "DATABASE_ERROR"
    );
  }

  if (halaqohList.length === 0) {
    return null; // Missing source halaqoh -> fail closed
  }

  if (halaqohList.length > 1) {
    throw new HalaqohMappingError(
      `Ambiguous halaqoh source for '${halaqohIdOrCode}': found ${halaqohList.length} rows`,
      "AMBIGUOUS_HALAQOH_SOURCE"
    );
  }

  const halaqoh = halaqohList[0];
  if (halaqoh.status !== "AKTIF") {
    // Inactive source Halaqoh -> fail closed
    return null;
  }

  // 2. Derive canonical OrgUnit code: "OU-" + halaqohCode
  const expectedOrgUnitCode = `OU-${halaqoh.halaqohCode}`;

  let orgUnits: Array<{
    id: string;
    code: string;
    type: string;
    domain: string;
    genderComplex: string;
    isActive: boolean;
  }>;
  try {
    // Look up primarily by canonical code "OU-" + halaqohCode, or fallback to matching orgUnit id if present
    orgUnits = await db.orgUnit.findMany({
      where: {
        OR: [
          { code: expectedOrgUnitCode },
          { id: halaqoh.id, type: "HALAQOH", domain: "TAHFIZH" },
        ],
      },
      select: {
        id: true,
        code: true,
        type: true,
        domain: true,
        genderComplex: true,
        isActive: true,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HalaqohMappingError(
      `Database error querying canonical OrgUnit for mapping: ${msg}`,
      "DATABASE_ERROR"
    );
  }

  if (orgUnits.length === 0) {
    return null; // Missing canonical OrgUnit -> fail closed
  }

  // If both canonical code and id matched different rows, check for exact code match first
  let orgUnit = orgUnits.find((u) => u.code === expectedOrgUnitCode);
  if (!orgUnit) {
    if (orgUnits.length === 1) {
      orgUnit = orgUnits[0];
    } else {
      throw new HalaqohMappingError(
        `Ambiguous canonical OrgUnit for '${expectedOrgUnitCode}': found ${orgUnits.length} rows`,
        "AMBIGUOUS_ORG_UNIT"
      );
    }
  }

  if (!orgUnit.isActive) {
    return null; // Inactive canonical OrgUnit -> fail closed
  }

  if (orgUnit.type !== "HALAQOH" || orgUnit.domain !== "TAHFIZH") {
    throw new HalaqohMappingError(
      `Canonical OrgUnit type/domain mismatch for '${orgUnit.code}': expected HALAQOH/TAHFIZH, got ${orgUnit.type}/${orgUnit.domain}`,
      "ORG_UNIT_TYPE_MISMATCH"
    );
  }

  return {
    halaqohId: halaqoh.id,
    halaqohCode: halaqoh.halaqohCode,
    halaqohName: halaqoh.nama,
    orgUnitId: orgUnit.id,
    orgUnitCode: orgUnit.code,
    genderComplex: orgUnit.genderComplex as GenderComplex,
  };
}

export async function resolveHalaqohForCanonicalOrgUnit(
  orgUnitIdOrCode: string,
  db: PrismaClient = defaultPrisma
): Promise<HalaqohOrgUnitMapping | null> {
  if (!orgUnitIdOrCode || typeof orgUnitIdOrCode !== "string") {
    return null;
  }

  const partialDb = db as unknown as {
    halaqoh?: { findMany?: unknown };
    orgUnit?: { findMany?: unknown };
  };
  if (
    !db ||
    typeof partialDb.halaqoh?.findMany !== "function" ||
    typeof partialDb.orgUnit?.findMany !== "function"
  ) {
    return null;
  }

  let orgUnits: Array<{
    id: string;
    code: string;
    type: string;
    domain: string;
    genderComplex: string;
    isActive: boolean;
  }>;
  try {
    orgUnits = await db.orgUnit.findMany({
      where: {
        OR: [
          { id: orgUnitIdOrCode },
          { code: orgUnitIdOrCode },
        ],
      },
      select: {
        id: true,
        code: true,
        type: true,
        domain: true,
        genderComplex: true,
        isActive: true,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HalaqohMappingError(
      `Database error querying OrgUnit for reverse mapping: ${msg}`,
      "DATABASE_ERROR"
    );
  }

  if (orgUnits.length === 0) {
    return null;
  }

  if (orgUnits.length > 1) {
    throw new HalaqohMappingError(
      `Ambiguous OrgUnit for reverse mapping '${orgUnitIdOrCode}': found ${orgUnits.length} rows`,
      "AMBIGUOUS_ORG_UNIT"
    );
  }

  const orgUnit = orgUnits[0];
  if (!orgUnit.isActive || orgUnit.type !== "HALAQOH" || orgUnit.domain !== "TAHFIZH") {
    return null; // Inactive or not a Tahfizh halaqoh -> fail closed
  }

  const halaqohCode = orgUnit.code.startsWith("OU-")
    ? orgUnit.code.slice(3)
    : orgUnit.code;

  let halaqohList: Array<{
    id: string;
    halaqohCode: string;
    nama: string;
    status: string;
  }>;
  try {
    halaqohList = await db.halaqoh.findMany({
      where: {
        OR: [
          { halaqohCode },
          { id: orgUnit.id },
        ],
      },
      select: {
        id: true,
        halaqohCode: true,
        nama: true,
        status: true,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HalaqohMappingError(
      `Database error querying halaqoh for reverse mapping: ${msg}`,
      "DATABASE_ERROR"
    );
  }

  if (halaqohList.length === 0) {
    return null;
  }

  let halaqoh = halaqohList.find((h) => h.halaqohCode === halaqohCode);
  if (!halaqoh) {
    if (halaqohList.length === 1) {
      halaqoh = halaqohList[0];
    } else {
      throw new HalaqohMappingError(
        `Ambiguous halaqoh for reverse mapping '${halaqohCode}': found ${halaqohList.length} rows`,
        "AMBIGUOUS_HALAQOH_SOURCE"
      );
    }
  }

  if (halaqoh.status !== "AKTIF") {
    return null;
  }

  return {
    halaqohId: halaqoh.id,
    halaqohCode: halaqoh.halaqohCode,
    halaqohName: halaqoh.nama,
    orgUnitId: orgUnit.id,
    orgUnitCode: orgUnit.code,
    genderComplex: orgUnit.genderComplex as GenderComplex,
  };
}

/**
 * Maps a list of canonical OrgUnit IDs to the corresponding authoritative Halaqoh IDs.
 * Used for runtime query filtering on Santri.halaqohId.
 */
export async function mapOrgUnitIdsToHalaqohIds(
  orgUnitIds: string[],
  db: PrismaClient = defaultPrisma
): Promise<string[]> {
  if (!orgUnitIds || orgUnitIds.length === 0) {
    return [];
  }

  const halaqohIds: string[] = [];
  for (const orgUnitId of orgUnitIds) {
    const mapping = await resolveHalaqohForCanonicalOrgUnit(orgUnitId, db);
    if (mapping) {
      halaqohIds.push(mapping.halaqohId);
    }
  }

  return halaqohIds;
}

/**
 * Maps a list of Halaqoh IDs to canonical OrgUnit IDs.
 */
export async function mapHalaqohIdsToOrgUnitIds(
  halaqohIds: string[],
  db: PrismaClient = defaultPrisma
): Promise<string[]> {
  if (!halaqohIds || halaqohIds.length === 0) {
    return [];
  }

  const orgUnitIds: string[] = [];
  for (const halaqohId of halaqohIds) {
    const mapping = await resolveCanonicalOrgUnitForHalaqoh(halaqohId, db);
    if (mapping) {
      orgUnitIds.push(mapping.orgUnitId);
    }
  }

  return orgUnitIds;
}
