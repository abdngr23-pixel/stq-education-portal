import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import { getAuditLogsAction } from '../app/actions/audit';
import { setTestSession, isExplicitTestRuntime } from '../lib/auth';
import prisma from '../lib/prisma';
import type { ICanonicalDataProvider } from '../lib/auth/canonical-evaluator';

describe('Audit Log Security Hardening & Regression Suite (BUG-01 / R1-005 / R1.1)', () => {
  before(() => {
    assert.ok(isExplicitTestRuntime(), 'Must execute in explicit test runtime');
  });

  after(() => {
    setTestSession(undefined);
  });

  // Test data provider with active Mudir canonical assignment and VERIFIED_PRODUCTION capability
  const mudirDataProvider: ICanonicalDataProvider = {
    getIdentity: async (userId: string) => ({
      userId,
      username: 'mudir.ks',
      status: 'AKTIF',
      accountType: 'PERSONAL',
      role: 'KS',
      staffId: 'stf_mudir',
      staffStatus: 'AKTIF',
      name: 'Mudir STQ',
    }),
    getActiveAssignments: async () => [
      {
        id: 'asgn_mudir',
        userId: 'test_ks',
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
    getUnitAccountPlacement: async () => null,
    verifyHumanExecutor: async () => null,
    resolveResourceContext: async () => null,
  };

  // Empty data provider for unauthorized users
  const unauthorizedDataProvider: ICanonicalDataProvider = {
    getIdentity: async (userId: string) => ({
      userId,
      username: 'unauth.user',
      status: 'AKTIF',
      accountType: 'PERSONAL',
      role: 'MT',
      staffId: 'stf_unauth',
      staffStatus: 'AKTIF',
      name: 'Unauthorized User',
    }),
    getActiveAssignments: async () => [],
    getUnitAccountPlacement: async () => null,
    verifyHumanExecutor: async () => null,
    resolveResourceContext: async () => null,
  };

  // A. FUNCTIONAL FAIL-CLOSED TEST
  it('A. Functional Fail-Closed: DB error never produces fake success or mock data', async () => {
    setTestSession({
      userId: 'test_ks',
      username: 'mudir.ks',
      role: Role.KS,
      name: 'Mudir STQ',
    });

    const originalFindMany = prisma.auditLog.findMany;
    try {
      (prisma.auditLog as unknown as { findMany: () => Promise<never> }).findMany = async () => {
        throw new Error('P1001: Can not connect to database server at 10.0.1.42:5432');
      };

      const res = await getAuditLogsAction({ dataProvider: mudirDataProvider });

      // Invariant: MUST fail closed with success: false
      assert.strictEqual(res.success, false, 'Must not return success: true on DB failure');
      assert.strictEqual(res.message, 'Gagal memuat log audit dari basis data.');
      assert.deepStrictEqual(res.data, [], 'Must return empty data array, never synthetic mock array');

      // Invariant: ZERO presence of decommissioned razan.mt
      const jsonStr = JSON.stringify(res);
      assert.ok(!jsonStr.includes('razan.mt'), 'Must never inject razan.mt into audit results');
    } finally {
      prisma.auditLog.findMany = originalFindMany;
    }
  });

  // B. INFORMATION DISCLOSURE TEST
  it('B. Information Disclosure: raw internal DB exception never leaves server boundary', async () => {
    setTestSession({
      userId: 'test_ks',
      username: 'mudir.ks',
      role: Role.KS,
      name: 'Mudir STQ',
    });

    const internalExceptionText = 'SECRET_DB_PASSWORD_AUTH_FAIL: host=db-internal.prod.stq.sch.id:5432 user=pgadmin';
    const originalFindMany = prisma.auditLog.findMany;
    try {
      (prisma.auditLog as unknown as { findMany: () => Promise<never> }).findMany = async () => {
        throw new Error(internalExceptionText);
      };

      const res = await getAuditLogsAction({ dataProvider: mudirDataProvider });

      // Serialized client response must NEVER contain internal DB exception details
      const serialized = JSON.stringify(res);
      assert.ok(!serialized.includes(internalExceptionText), 'Raw internal error text must NOT be present in serialized response');
      assert.ok(!serialized.includes('db-internal.prod.stq.sch.id'), 'DB hostname must NOT be exposed');
      assert.ok(!serialized.includes('pgadmin'), 'DB user must NOT be exposed');

      // Sanitized error code must be returned instead
      assert.strictEqual(res.errorCode, 'AUDIT_LOG_QUERY_FAILED');
      assert.strictEqual(res.error, 'AUDIT_LOG_QUERY_FAILED');
    } finally {
      prisma.auditLog.findMany = originalFindMany;
    }
  });

  // C & D. CANONICAL AUTHORIZATION CONTRACT TESTS
  it('D1. Canonical Contract Denial: unauthenticated call fails closed with unauthorized error', async () => {
    setTestSession(null);
    const res = await getAuditLogsAction({ dataProvider: mudirDataProvider });
    assert.strictEqual(res.success, false);
    assert.match(res.message, /UNAUTHORIZED/i);
    assert.deepStrictEqual(res.data, []);
  });

  it('D2. Canonical Contract Denial: unauthorized roles (MT, PH, MK, OSDA, ST, WS) fail closed', async () => {
    const forbiddenRoles: Role[] = [Role.MT, Role.PH, Role.MK, Role.OSDA, Role.ST, Role.WS];
    for (const role of forbiddenRoles) {
      setTestSession({
        userId: `test_${role.toLowerCase()}`,
        username: `user.${role.toLowerCase()}`,
        role,
        name: `Test ${role}`,
      });

      const res = await getAuditLogsAction({ dataProvider: unauthorizedDataProvider });
      assert.strictEqual(res.success, false, `Role ${role} must be rejected`);
      assert.match(res.message, /FORBIDDEN/i);
      assert.deepStrictEqual(res.data, []);
    }
  });

  it('D3. Owner Policy Decision: ADM and YAY role denied, MUDIR canonical grant allowed', async () => {
    const mockDate = new Date('2026-10-02T12:00:00.000Z');
    const originalFindMany = prisma.auditLog.findMany;
    try {
      (prisma.auditLog as unknown as { findMany: () => Promise<unknown[]> }).findMany = async () => [
        {
          id: 'audit-real-1',
          action: 'LOGIN',
          entity: 'User',
          entityId: 'usr-1',
          details: { ip: '127.0.0.1' },
          createdAt: mockDate,
          user: {
            username: 'mudir.ks',
            email: 'mudir@stqduc.sch.id',
            role: 'KS',
          },
        },
      ];

      // 1. ADM role without canonical grant => DENIED
      setTestSession({
        userId: 'test_admin',
        username: 'admin.tu',
        role: Role.ADM,
        name: 'Admin TU',
      });
      const admRes = await getAuditLogsAction({ dataProvider: unauthorizedDataProvider });
      assert.strictEqual(admRes.success, false, 'ADM must be DENIED access to audit log');
      assert.match(admRes.message, /FORBIDDEN/i);

      // 2. YAY legacy role without canonical grant => DENIED
      setTestSession({
        userId: 'test_yay',
        username: 'yayasan.lead',
        role: Role.YAY,
        name: 'Pengurus Yayasan',
      });
      const yayRes = await getAuditLogsAction({ dataProvider: unauthorizedDataProvider });
      assert.strictEqual(yayRes.success, false, 'Legacy YAY role must be DENIED access to audit log');
      assert.match(yayRes.message, /FORBIDDEN/i);

      // 3. MUDIR canonical grant => ALLOWED
      setTestSession({
        userId: 'test_ks',
        username: 'mudir.ks',
        role: Role.KS,
        name: 'Mudir STQ',
      });
      const mudirRes = await getAuditLogsAction({ dataProvider: mudirDataProvider });
      assert.strictEqual(mudirRes.success, true, 'Canonical MUDIR must be ALLOWED');
      assert.strictEqual(mudirRes.message, 'Berhasil memuat log audit');
      assert.ok(Array.isArray(mudirRes.data));
      assert.strictEqual(mudirRes.data.length, 1);
      assert.strictEqual(mudirRes.data[0].id, 'audit-real-1');
      assert.strictEqual(mudirRes.data[0].user.username, 'mudir.ks');
      assert.strictEqual(mudirRes.data[0].action, 'LOGIN');
    } finally {
      prisma.auditLog.findMany = originalFindMany;
    }
  });
});
