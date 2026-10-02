import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import { getAuditLogsAction } from '../app/actions/audit';
import { setTestSession, isExplicitTestRuntime } from '../lib/auth';
import prisma from '../lib/prisma';

describe('Audit Log Security Hardening & Regression Suite (BUG-01 / R1-005)', () => {
  before(() => {
    assert.ok(isExplicitTestRuntime(), 'Must execute in explicit test runtime');
  });

  after(() => {
    setTestSession(undefined);
  });

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

      const res = await getAuditLogsAction();

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

      const res = await getAuditLogsAction();

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

  // C & D. LEGACY CONTRACT AUTHORIZATION TESTS
  it('D1. Legacy Contract Denial: unauthenticated call fails closed with unauthorized error', async () => {
    setTestSession(null);
    const res = await getAuditLogsAction();
    assert.strictEqual(res.success, false);
    assert.match(res.message, /UNAUTHORIZED/i);
    assert.deepStrictEqual(res.data, []);
  });

  it('D2. Legacy Contract Denial: unauthorized roles (MT, PH, MK, OSDA, ST, WS) fail closed', async () => {
    const forbiddenRoles: Role[] = [Role.MT, Role.PH, Role.MK, Role.OSDA, Role.ST, Role.WS];
    for (const role of forbiddenRoles) {
      setTestSession({
        userId: `test_${role.toLowerCase()}`,
        username: `user.${role.toLowerCase()}`,
        role,
        name: `Test ${role}`,
      });

      const res = await getAuditLogsAction();
      assert.strictEqual(res.success, false, `Role ${role} must be rejected`);
      assert.match(res.message, /FORBIDDEN/i);
      assert.deepStrictEqual(res.data, []);
    }
  });

  it('D3. Legacy Contract Positive Call: authorized roles (ADM/KS/YAY) return real logs', async () => {
    setTestSession({
      userId: 'test_admin',
      username: 'admin.tu',
      role: Role.ADM,
      name: 'Admin TU',
    });

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

      const res = await getAuditLogsAction();
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.message, 'Berhasil memuat log audit');
      assert.ok(Array.isArray(res.data));
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].id, 'audit-real-1');
      assert.strictEqual(res.data[0].user.username, 'mudir.ks');
      assert.strictEqual(res.data[0].action, 'LOGIN');
    } finally {
      prisma.auditLog.findMany = originalFindMany;
    }
  });
});

