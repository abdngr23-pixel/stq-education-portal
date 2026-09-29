import {
  PrismaClient,
  CapabilityNamespace,
  BusinessRuleState,
  ScopeType,
} from "@prisma/client";

/**
 * Authoritative Canonical Test Fixture Helper for Gate 5 Tahfizh Tests.
 * Ensures consistent canonical state (Capability, Position, PositionCapability, OrgUnit, Assignment)
 * in isolated test databases.
 */

export async function ensureCanonicalTahfizhBase(prisma: PrismaClient) {
  // 1. Ensure Capabilities exist
  const caps: Array<{
    code: string;
    namespace: CapabilityNamespace;
    name: string;
    description: string;
  }> = [
    { code: "tahfizh.recap.read", namespace: CapabilityNamespace.TAHFIZH, name: "Read Tahfizh Recap", description: "Recap Read" },
    { code: "tahfizh.target.manage", namespace: CapabilityNamespace.TAHFIZH, name: "Manage Tahfizh Target", description: "Target Manage" },
  ];
  for (const c of caps) {
    await prisma.capability.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        namespace: c.namespace,
        name: c.name,
        description: c.description,
      },
    });
  }

  // 2. Ensure Positions exist
  const posMusyrif = await prisma.position.upsert({
    where: { code: "MUSYRIF_TAHFIZH" },
    update: {},
    create: {
      id: "pos-musyrif-tahfizh",
      code: "MUSYRIF_TAHFIZH",
      name: "Musyrif Tahfizh",
      domain: "TAHFIZH",
      allowedUnitTypes: ["HALAQOH"],
      isActive: true,
      requiresPersonalAccount: true,
    },
  });

  const posKabid = await prisma.position.upsert({
    where: { code: "PETUGAS_OPERASIONAL_TAHFIZH" },
    update: {},
    create: {
      id: "pos-kabid-tahfizh",
      code: "PETUGAS_OPERASIONAL_TAHFIZH",
      name: "Kabid Tahfizh",
      domain: "TAHFIZH",
      allowedUnitTypes: ["HALAQOH", "DOMAIN", "INSTITUTION"],
      isActive: true,
      isLeadership: true,
      requiresPersonalAccount: true,
    },
  });

  // 3. Ensure PositionCapabilities exist
  const pcs: Array<{
    id: string;
    positionId: string;
    capabilityCode: string;
    scopeType: ScopeType;
    businessRuleState: BusinessRuleState;
  }> = [
    {
      id: "pc-musyrif-recap",
      positionId: posMusyrif.id,
      capabilityCode: "tahfizh.recap.read",
      scopeType: ScopeType.HALAQOH,
      businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
    },
    {
      id: "pc-musyrif-target",
      positionId: posMusyrif.id,
      capabilityCode: "tahfizh.target.manage",
      scopeType: ScopeType.HALAQOH,
      businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
    },
    {
      id: "pc-kabid-recap",
      positionId: posKabid.id,
      capabilityCode: "tahfizh.recap.read",
      scopeType: ScopeType.GLOBAL,
      businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
    },
    {
      id: "pc-kabid-target",
      positionId: posKabid.id,
      capabilityCode: "tahfizh.target.manage",
      scopeType: ScopeType.GLOBAL,
      businessRuleState: BusinessRuleState.VERIFIED_PRODUCTION,
    },
  ];

  for (const pc of pcs) {
    await prisma.positionCapability.upsert({
      where: {
        positionId_capabilityCode: {
          positionId: pc.positionId,
          capabilityCode: pc.capabilityCode,
        },
      },
      update: {
        businessRuleState: pc.businessRuleState,
        scopeType: pc.scopeType,
      },
      create: {
        id: pc.id,
        positionId: pc.positionId,
        capabilityCode: pc.capabilityCode,
        scopeType: pc.scopeType,
        businessRuleState: pc.businessRuleState,
      },
    });
  }

  return { posMusyrif, posKabid };
}

export async function createCanonicalHalaqohOrgUnit(
  prisma: PrismaClient,
  halaqohCode: string,
  options?: { id?: string; name?: string; genderComplex?: "PUTRA" | "PUTRI" }
) {
  const code = halaqohCode.startsWith("OU-") ? halaqohCode : `OU-${halaqohCode}`;
  return prisma.orgUnit.upsert({
    where: { code },
    update: { isActive: true },
    create: {
      ...(options?.id ? { id: options.id } : {}),
      code,
      name: options?.name || `OrgUnit ${code}`,
      type: "HALAQOH",
      domain: "TAHFIZH",
      genderComplex: options?.genderComplex || "PUTRA",
      isActive: true,
    },
  });
}

export async function assignCanonicalMusyrif(
  prisma: PrismaClient,
  params: {
    userId: string;
    halaqohCode: string;
    assignmentId?: string;
  }
) {
  const { posMusyrif } = await ensureCanonicalTahfizhBase(prisma);
  const orgUnit = await createCanonicalHalaqohOrgUnit(prisma, params.halaqohCode);

  return prisma.assignment.upsert({
    where: { id: params.assignmentId || `asg-musyrif-${params.userId}-${params.halaqohCode}` },
    update: { status: "ACTIVE", unitId: orgUnit.id },
    create: {
      id: params.assignmentId || `asg-musyrif-${params.userId}-${params.halaqohCode}`,
      userId: params.userId,
      positionId: posMusyrif.id,
      unitId: orgUnit.id,
      status: "ACTIVE",
      createdById: params.userId,
      validFrom: new Date("2026-01-01T00:00:00Z"),
    },
  });
}

export async function assignCanonicalKabid(
  prisma: PrismaClient,
  params: {
    userId: string;
    assignmentId?: string;
  }
) {
  const { posKabid } = await ensureCanonicalTahfizhBase(prisma);
  const orgUnit = await prisma.orgUnit.upsert({
    where: { code: "OU-TAHFIZH-PUSAT" },
    update: { isActive: true },
    create: {
      id: "ou-tahfizh-pusat",
      code: "OU-TAHFIZH-PUSAT",
      name: "Divisi Tahfizh Pusat",
      type: "DOMAIN",
      domain: "TAHFIZH",
      genderComplex: "CAMPUR",
      isActive: true,
    },
  });

  return prisma.assignment.upsert({
    where: { id: params.assignmentId || `asg-kabid-${params.userId}` },
    update: { status: "ACTIVE", unitId: orgUnit.id },
    create: {
      id: params.assignmentId || `asg-kabid-${params.userId}`,
      userId: params.userId,
      positionId: posKabid.id,
      unitId: orgUnit.id,
      status: "ACTIVE",
      createdById: params.userId,
      validFrom: new Date("2026-01-01T00:00:00Z"),
    },
  });
}
