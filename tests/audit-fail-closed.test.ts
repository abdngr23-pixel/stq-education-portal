import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import { getAuditLogsAction } from '../app/actions/audit';
import { setTestSession, isExplicitTestRuntime } from '../lib/auth';
import prisma from '../lib/prisma';

describe('Audit Log Fail-Closed & Mock Elimination Regression Suite (BUG-01)', () => {
  before(() => {
    assert.ok(isExplicitTestRuntime(), 'Must execute in explicit test runtime');
  });

  after(() => {
    setTestSession(undefined);
  });

  it('1. Role Denial: unauthenticated call fails closed with unauthorized error', async () => {
    setTestSession(null);
    const res = await getAuditLogsAction();
    assert.strictEqual(res.success, false);
    assert.match(res.message, /UNAUTHORIZED/i);
    assert.deepStrictEqual(res.data, []);
  });

  it('2. Role Denial: unauthorized roles (MT, PH, MK, OSDA, ST, WS) fail closed', async () => {
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

  it('3. Fail-Closed on Database Query Failure: never returns mock data or fake success', async () => {
    setTestSession({
      userId: 'test_ks',
      username: 'mudir.ks',
      role: Role.KS,
      name: 'Mudir STQ',
    });

    // Mock prisma.auditLog.findMany to throw a simulated database failure
    const originalFindMany = prisma.auditLog.findMany;
    try {
      (prisma.auditLog as unknown as { findMany: () => Promise<never> }).findMany = async () => {
        throw new Error('SIMULATED_DB_NETWORK_TIMEOUT');
      };

      const res = await getAuditLogsAction();

      // Invariant: MUST fail closed with success: false
      assert.strictEqual(res.success, false, 'Must not return success: true on DB failure');
      assert.strictEqual(res.message, 'Gagal memuat log audit dari basis data.');
      assert.strictEqual(res.error, 'SIMULATED_DB_NETWORK_TIMEOUT');
      assert.deepStrictEqual(res.data, [], 'Must return empty data array, never synthetic mock array');

      // Invariant: ZERO presence of decommissioned razan.mt
      const jsonStr = JSON.stringify(res);
      assert.ok(!jsonStr.includes('razan.mt'), 'Must never inject razan.mt into audit results');
    } finally {
      prisma.auditLog.findMany = originalFindMany;
    }
  });

  it('4. Positive Authorized Call (KS/YAY/ADM): returns real formatted logs when DB succeeds', async () => {
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
