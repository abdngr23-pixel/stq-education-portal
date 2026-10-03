import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import { getAuditLogsAction } from '../app/actions/audit';
import { setTestSession, isExplicitTestRuntime } from '../lib/auth';
import prisma from '../lib/prisma';
import type {
  ICanonicalDataProvider,
  CanonicalIdentity,
  CanonicalAssignmentWithDetails,
} from '../lib/auth/canonical-evaluator';
import type { BusinessRuleState } from '../types/architecture-lock';

describe('Audit Log Canonical Authorization & Security Suite (R1.1 / Owner Decision)', () => {
  before(() => {
    assert.ok(isExplicitTestRuntime(), 'Must execute in explicit test runtime');
  });

  after(() => {
    setTestSession(undefined);
  });

  /**
   * Helper to construct a controlled test data provider
   */
  function createTestDataProvider(overrides: {
    identity?: Partial<CanonicalIdentity> | null;
    assignments?: CanonicalAssignmentWithDetails[];
  }): ICanonicalDataProvider {
    const baseIdentity: CanonicalIdentity = {
      userId: 'usr_mudir_1',
      username: 'mudir.ks',
      status: 'AKTIF',
      accountType: 'PERSONAL',
      role: 'KS',
      staffId: 'stf_mudir_1',
      staffStatus: 'AKTIF',
      name: 'KH. Mudir Utama',
      ...overrides.identity,
    };

    return {
      getIdentity: async (userId: string) => {
        if (overrides.identity === null) return null;
        return { ...baseIdentity, userId };
      },
      getActiveAssignments: async () => overrides.assignments ?? [],
      getUnitAccountPlacement: async () => null,
      verifyHumanExecutor: async () => null,
      resolveResourceContext: async () => null,
    };
  }

  // --- CASE A: Positive Canonical Activation Simulation ---
  it('CASE A: Active User, Active Staff, Active Assignment (MUDIR / GLOBAL / VERIFIED_PRODUCTION) => ALLOW', async () => {
    setTestSession({
      userId: 'usr_mudir_1',
      username: 'mudir.ks',
      role: Role.KS,
      staffId: 'stf_mudir_1',
      name: 'KH. Mudir Utama',
    });

    const dataProvider = createTestDataProvider({
      assignments: [
        {
          id: 'asgn_mudir_1',
          userId: 'usr_mudir_1',
          positionId: 'pos_mudir',
          positionCode: 'MUDIR',
          positionName: 'Mudir Pesantren',
          domain: 'INSTITUTIONAL',
          unitId: 'unit_stq',
          unitCode: 'STQ_CENTRAL',
          unitName: 'STQ Darul Ulum Cendekia',
          status: 'ACTIVE',
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          requiresPersonalAccount: true,
          positionCapabilities: [
            {
              capabilityCode: 'system.audit.read',
              scopeType: 'GLOBAL',
              businessRuleState: 'VERIFIED_PRODUCTION',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const originalFindMany = prisma.auditLog.findMany;
    try {
      (prisma.auditLog as unknown as { findMany: () => Promise<unknown[]> }).findMany = async () => [
        {
          id: 'audit-case-a',
          action: 'SETTINGS_UPDATE',
          entity: 'SystemConfig',
          entityId: 'cfg-1',
          details: { key: 'portal_status', value: 'production_ready' },
          createdAt: new Date('2026-10-02T12:00:00Z'),
          user: { username: 'mudir.ks', email: 'mudir@stqduc.sch.id', role: 'KS' },
        },
      ];

      const res = await getAuditLogsAction({ dataProvider });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.message, 'Berhasil memuat log audit');
      assert.ok(Array.isArray(res.data));
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].id, 'audit-case-a');
    } finally {
      prisma.auditLog.findMany = originalFindMany;
    }
  });

  // --- CASE B: KS/MUDIR role metadata but NO canonical grant ---
  it('CASE B: Role KS/MUDIR metadata but NO canonical grant => DENY', async () => {
    setTestSession({
      userId: 'usr_ks_legacy',
      username: 'ks.legacy',
      role: Role.KS,
      name: 'Legacy KS',
    });

    // Assignments exist but have no system.audit.read capability
    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_ks_legacy', username: 'ks.legacy', role: 'KS' },
      assignments: [
        {
          id: 'asgn_ks_other',
          userId: 'usr_ks_legacy',
          positionId: 'pos_mudir',
          positionCode: 'MUDIR',
          positionName: 'Mudir',
          domain: 'INSTITUTIONAL',
          unitId: 'unit_stq',
          unitCode: 'STQ_CENTRAL',
          unitName: 'STQ',
          status: 'ACTIVE',
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: 'tahfizh.policy.manage',
              scopeType: 'GLOBAL',
              businessRuleState: 'VERIFIED_PRODUCTION',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.match(res.message, /FORBIDDEN/i);
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE C: ADM role only ---
  it('CASE C: ADM role only => DENY (Explicitly excluded by Owner Decision)', async () => {
    setTestSession({
      userId: 'usr_adm_1',
      username: 'admin.tu',
      role: Role.ADM,
      name: 'Admin TU',
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_adm_1', username: 'admin.tu', role: 'ADM', staffId: 'stf_adm_1' },
      assignments: [
        {
          id: 'asgn_adm_1',
          userId: 'usr_adm_1',
          positionId: 'pos_adm',
          positionCode: 'STAF_ADMIN_TU',
          positionName: 'Staf Admin TU',
          domain: 'MANAJEMEN',
          unitId: 'unit_tu',
          unitCode: 'TU_CENTRAL',
          unitName: 'Tata Usaha',
          status: 'ACTIVE',
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: 'tahfizh.recap.read',
              scopeType: 'GLOBAL',
              businessRuleState: 'VERIFIED_PRODUCTION',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.match(res.message, /FORBIDDEN/i);
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE D: YAY legacy role only ---
  it('CASE D: YAY legacy role only => DENY (Zero authority by role; Yayasan canonical deferred)', async () => {
    setTestSession({
      userId: 'usr_yay_1',
      username: 'pengurus.yayasan',
      role: Role.YAY,
      name: 'Pengurus Yayasan',
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_yay_1', username: 'pengurus.yayasan', role: 'YAY', staffId: null },
      assignments: [], // Zero canonical position or assignment
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.match(res.message, /FORBIDDEN/i);
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE E: ordinary MUSYRIF_TAHFIZH ---
  it('CASE E: ordinary MUSYRIF_TAHFIZH => DENY', async () => {
    setTestSession({
      userId: 'usr_mt_1',
      username: 'musyrif.1',
      role: Role.MT,
      name: 'Musyrif Tahfizh',
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mt_1', username: 'musyrif.1', role: 'MT', staffId: 'stf_mt_1' },
      assignments: [
        {
          id: 'asgn_mt_1',
          userId: 'usr_mt_1',
          positionId: 'pos_mt',
          positionCode: 'MUSYRIF_TAHFIZH',
          positionName: 'Musyrif Tahfizh',
          domain: 'TAHFIZH',
          unitId: 'unit_hlq_1',
          unitCode: 'HLQ_1',
          unitName: 'Halaqoh 1',
          status: 'ACTIVE',
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: 'tahfizh.setoran.create',
              scopeType: 'HALAQOH',
              businessRuleState: 'VERIFIED_PRODUCTION',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE F: KEPALA_KEASRAMAAN ---
  it('CASE F: KEPALA_KEASRAMAAN => DENY', async () => {
    setTestSession({
      userId: 'usr_mk_1',
      username: 'musyrif.keasramaan',
      role: Role.MK,
      name: 'Kepala Keasramaan',
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mk_1', username: 'musyrif.keasramaan', role: 'MK', staffId: 'stf_mk_1' },
      assignments: [
        {
          id: 'asgn_mk_1',
          userId: 'usr_mk_1',
          positionId: 'pos_mk',
          positionCode: 'KEPALA_KEASRAMAAN',
          positionName: 'Kepala Keasramaan',
          domain: 'KEASRAMAAN',
          unitId: 'unit_asrama',
          unitCode: 'ASRAMA_ALL',
          unitName: 'Komplek Asrama',
          status: 'ACTIVE',
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: 'keasramaan.permission.read',
              scopeType: 'DOMAIN',
              businessRuleState: 'VERIFIED_PRODUCTION',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE G: Inactive User ---
  it('CASE G: Inactive User in database => DENY (IDENTITY_INACTIVE)', async () => {
    setTestSession({
      userId: 'usr_mudir_inact',
      username: 'mudir.inactive',
      role: Role.KS,
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mudir_inact', status: 'NONAKTIF' },
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'IDENTITY_INACTIVE');
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE H: Inactive Staff ---
  it('CASE H: Inactive Staff in database => DENY (IDENTITY_INACTIVE)', async () => {
    setTestSession({
      userId: 'usr_mudir_stf_inact',
      username: 'mudir.staffinact',
      role: Role.KS,
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mudir_stf_inact', status: 'AKTIF', staffStatus: 'NONAKTIF' },
      assignments: [
        {
          id: 'asgn_mudir_h',
          userId: 'usr_mudir_stf_inact',
          positionId: 'pos_mudir',
          positionCode: 'MUDIR',
          positionName: 'Mudir',
          domain: 'INSTITUTIONAL',
          unitId: 'unit_stq',
          unitCode: 'STQ_CENTRAL',
          unitName: 'STQ Central',
          status: 'ACTIVE',
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: 'system.audit.read',
              scopeType: 'GLOBAL',
              businessRuleState: 'VERIFIED_PRODUCTION',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'IDENTITY_INACTIVE');
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE I: Inactive Assignment/Position ---
  it('CASE I: Inactive Assignment status (SUSPENDED) => DENY', async () => {
    setTestSession({
      userId: 'usr_mudir_pos_inact',
      username: 'mudir.posinact',
      role: Role.KS,
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mudir_pos_inact' },
      assignments: [
        {
          id: 'asgn_mudir_i',
          userId: 'usr_mudir_pos_inact',
          positionId: 'pos_mudir',
          positionCode: 'MUDIR',
          positionName: 'Mudir',
          domain: 'INSTITUTIONAL',
          unitId: 'unit_stq',
          unitCode: 'STQ_CENTRAL',
          unitName: 'STQ Central',
          status: 'SUSPENDED', // Inactive assignment
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: 'system.audit.read',
              scopeType: 'GLOBAL',
              businessRuleState: 'VERIFIED_PRODUCTION',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE J: Missing Assignment ---
  it('CASE J: Missing Assignment => DENY', async () => {
    setTestSession({
      userId: 'usr_mudir_no_asgn',
      username: 'mudir.noasgn',
      role: Role.KS,
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mudir_no_asgn' },
      assignments: [],
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE K: Expired Assignment ---
  it('CASE K: Expired Assignment => DENY', async () => {
    setTestSession({
      userId: 'usr_mudir_exp',
      username: 'mudir.exp',
      role: Role.KS,
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mudir_exp' },
      assignments: [
        {
          id: 'asgn_mudir_k',
          userId: 'usr_mudir_exp',
          positionId: 'pos_mudir',
          positionCode: 'MUDIR',
          positionName: 'Mudir',
          domain: 'INSTITUTIONAL',
          unitId: 'unit_stq',
          unitCode: 'STQ_CENTRAL',
          unitName: 'STQ Central',
          status: 'ACTIVE',
          validFrom: new Date('2025-01-01'),
          validUntil: new Date('2025-12-31'), // Expired in 2025
          positionCapabilities: [
            {
              capabilityCode: 'system.audit.read',
              scopeType: 'GLOBAL',
              businessRuleState: 'VERIFIED_PRODUCTION',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const res = await getAuditLogsAction({
      dataProvider,
      now: new Date('2026-10-02'),
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE L: PositionCapability = APPROVED_TARGET_PENDING_TECHNICAL ---
  it('CASE L: PositionCapability = APPROVED_TARGET_PENDING_TECHNICAL => DENY at current runtime activation semantics', async () => {
    setTestSession({
      userId: 'usr_mudir_target',
      username: 'mudir.target',
      role: Role.KS,
    });

    // In current candidate state, system.audit.read is APPROVED_TARGET_PENDING_TECHNICAL
    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mudir_target' },
      assignments: [
        {
          id: 'asgn_mudir_l',
          userId: 'usr_mudir_target',
          positionId: 'pos_mudir',
          positionCode: 'MUDIR',
          positionName: 'Mudir',
          domain: 'INSTITUTIONAL',
          unitId: 'unit_stq',
          unitCode: 'STQ_CENTRAL',
          unitName: 'STQ Central',
          status: 'ACTIVE',
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: 'system.audit.read',
              scopeType: 'GLOBAL',
              businessRuleState: 'APPROVED_TARGET_PENDING_TECHNICAL',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.match(res.message, /APPROVED_TARGET_PENDING_TECHNICAL/i);
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE M: PositionCapability = PROPOSED_TBD ---
  it('CASE M: PositionCapability = PROPOSED_TBD => DENY', async () => {
    setTestSession({
      userId: 'usr_mudir_prop',
      username: 'mudir.prop',
      role: Role.KS,
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mudir_prop' },
      assignments: [
        {
          id: 'asgn_mudir_m',
          userId: 'usr_mudir_prop',
          positionId: 'pos_mudir',
          positionCode: 'MUDIR',
          positionName: 'Mudir',
          domain: 'INSTITUTIONAL',
          unitId: 'unit_stq',
          unitCode: 'STQ_CENTRAL',
          unitName: 'STQ Central',
          status: 'ACTIVE',
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: 'system.audit.read',
              scopeType: 'GLOBAL',
              businessRuleState: 'PROPOSED_TBD',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.deepStrictEqual(res.data, []);
  });

  // --- CASE N: Unknown/Missing BusinessRuleState ---
  it('CASE N: Missing/unknown BusinessRuleState => DENY', async () => {
    setTestSession({
      userId: 'usr_mudir_unknown',
      username: 'mudir.unknown',
      role: Role.KS,
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mudir_unknown' },
      assignments: [
        {
          id: 'asgn_mudir_n',
          userId: 'usr_mudir_unknown',
          positionId: 'pos_mudir',
          positionCode: 'MUDIR',
          positionName: 'Mudir',
          domain: 'INSTITUTIONAL',
          unitId: 'unit_stq',
          unitCode: 'STQ_CENTRAL',
          unitName: 'STQ Central',
          status: 'ACTIVE',
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: 'system.audit.read',
              scopeType: 'GLOBAL',
              businessRuleState: 'UNKNOWN_STATE' as BusinessRuleState,
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const res = await getAuditLogsAction({ dataProvider });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'CAPABILITY_NOT_GRANTED');
    assert.deepStrictEqual(res.data, []);
  });

  // --- INFORMATION DISCLOSURE REGRESSION ---
  it('Information Disclosure: raw internal DB exception never leaves server boundary upon findMany failure', async () => {
    setTestSession({
      userId: 'usr_mudir_sec',
      username: 'mudir.sec',
      role: Role.KS,
      staffId: 'stf_mudir_sec',
    });

    const dataProvider = createTestDataProvider({
      identity: { userId: 'usr_mudir_sec', staffId: 'stf_mudir_sec' },
      assignments: [
        {
          id: 'asgn_mudir_sec',
          userId: 'usr_mudir_sec',
          positionId: 'pos_mudir',
          positionCode: 'MUDIR',
          positionName: 'Mudir',
          domain: 'INSTITUTIONAL',
          unitId: 'unit_stq',
          unitCode: 'STQ_CENTRAL',
          unitName: 'STQ Central',
          status: 'ACTIVE',
          validFrom: new Date('2026-01-01'),
          validUntil: null,
          positionCapabilities: [
            {
              capabilityCode: 'system.audit.read',
              scopeType: 'GLOBAL',
              businessRuleState: 'VERIFIED_PRODUCTION',
            },
          ],
          scopeUnits: [],
        },
      ],
    });

    const secretHost = 'db-primary-internal.cloud.stq.sch.id:5432';
    const secretPasswordLeak = 'FATAL_AUTH_FAILED: password authentication failed for postgres_admin';

    const originalFindMany = prisma.auditLog.findMany;
    try {
      (prisma.auditLog as unknown as { findMany: () => Promise<never> }).findMany = async () => {
        throw new Error(`${secretPasswordLeak} at ${secretHost}`);
      };

      const res = await getAuditLogsAction({ dataProvider });

      // Invariants:
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.message, 'Gagal memuat log audit dari basis data.');
      assert.strictEqual(res.errorCode, 'AUDIT_LOG_QUERY_FAILED');
      assert.deepStrictEqual(res.data, []);

      // Verify ZERO presence of secret tokens in serialized output
      const serialized = JSON.stringify(res);
      assert.ok(!serialized.includes(secretHost), 'Must never leak internal db hostname');
      assert.ok(!serialized.includes(secretPasswordLeak), 'Must never leak db exception text');
      assert.ok(!serialized.includes('postgres_admin'), 'Must never leak db user');
    } finally {
      prisma.auditLog.findMany = originalFindMany;
    }
  });
});
