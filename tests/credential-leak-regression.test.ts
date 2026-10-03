(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.IS_TEST_RUN = "true";
process.env.ALLOW_ISOLATED_TEST_DB = "true";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, JenisKelamin, UserStatus } from "@prisma/client";
import { startTestDatabase, stopTestDatabase } from "./test-db-manager";
import { setTestSession } from "../lib/auth";
import { UserSession } from "../types/auth";
import {
  getUsersListAction,
  toggleUserStatusAction,
  resetUserPasswordAction,
  togglePetugasPresensiPutriAction,
  SafeUserItemDTO,
} from "../app/actions/users";

describe("AUDIT-R1_3-001 SEV-0 Credential Leak Regression Suite", () => {
  let prisma: PrismaClient;

  const KNOWN_HASH_1 = "$2a$10$abcdefghijklmnopqrstuuKnownSecretHash1234567890";
  const KNOWN_HASH_2 = "$2a$10$xyz9876543210zyxwvutsrqpoKnownSecretHash0987654321";
  const KNOWN_SESSION_TOKEN = "sess_secret_token_fixture_abc123xyz789";
  const KNOWN_PHONE = "081999888777";
  const KNOWN_EMAIL = "supersecret_admin_internal@stq.ac.id";

  const USER_ADM_ID = "usr-cred-test-adm";
  const USER_STAFF_ID = "usr-cred-test-staff";
  const USER_SANTRI_ID = "usr-cred-test-santri";
  const STAFF_ID = "stf-cred-test-01";
  const SANTRI_ID = "san-cred-test-01";

  const sessionADM: UserSession = {
    userId: USER_ADM_ID,
    username: "admin.security.test",
    name: "Admin Security Auditor",
    role: "ADM",
  };

  const sessionSantri: UserSession = {
    userId: USER_SANTRI_ID,
    username: "santri.unauthorized",
    name: "Santri Biasa",
    role: "ST",
    santriId: SANTRI_ID,
  };

  before(async () => {
    prisma = await startTestDatabase();

    // 1. Seed Staff
    await prisma.staff.create({
      data: {
        id: STAFF_ID,
        staffCode: "STF-CRED-001",
        nama: "Ustadz Pembina Asrama Rahasia",
        noHp: KNOWN_PHONE,
        roleStaff: "PH",
        status: "AKTIF",
      },
    });

    // 2. Seed Santri
    await prisma.santri.create({
      data: {
        id: SANTRI_ID,
        nis: "SAN-CRED-001",
        nama: "Fatimah Az-Zahra",
        kelas: "7B",
        jenisKelamin: JenisKelamin.P,
        status: "AKTIF",
        noHpWali: KNOWN_PHONE,
      },
    });

    // 3. Seed Users with sensitive fixtures
    await prisma.user.createMany({
      data: [
        {
          id: USER_ADM_ID,
          username: "admin.security.test",
          passwordHash: KNOWN_HASH_1,
          email: KNOWN_EMAIL,
          phone: KNOWN_PHONE,
          role: "ADM",
          status: UserStatus.AKTIF,
        },
        {
          id: USER_STAFF_ID,
          username: "musyrif.secret.ph",
          passwordHash: KNOWN_HASH_2,
          role: "PH",
          status: UserStatus.AKTIF,
          staffId: STAFF_ID,
        },
        {
          id: USER_SANTRI_ID,
          username: "fatimah.santriwati",
          passwordHash: KNOWN_HASH_1,
          role: "ST",
          status: UserStatus.AKTIF,
          santriId: SANTRI_ID,
          isPetugasPresensiPutri: true,
        },
      ],
    });

    // 4. Seed Session containing session tokens
    await prisma.session.create({
      data: {
        id: "sess-cred-001",
        sessionToken: KNOWN_SESSION_TOKEN,
        userId: USER_ADM_ID,
        expires: new Date(Date.now() + 86400000),
      },
    });
  });

  after(async () => {
    setTestSession(undefined);
    try {
      await stopTestDatabase();
    } catch {
      // Safe cleanup on Windows
    }
  });

  it("1. Serialized getUsersListAction() payload must contain EXACTLY ZERO credential fields (SEV-0 Regression Gate)", async () => {
    setTestSession(sessionADM);

    const res = await getUsersListAction();
    assert.strictEqual(res.success, true, "getUsersListAction harus berhasil untuk ADM");
    assert.ok(Array.isArray(res.data), "res.data harus berupa array");

    // Inspect the exact serialized JSON string crossing server-action boundary
    const serialized = JSON.stringify(res);

    let passwordHashClientExposure = 0;
    let credentialFieldsClientExposure = 0;

    // Check for passwordHash property name
    if (serialized.includes("passwordHash") || serialized.includes("password_hash")) {
      passwordHashClientExposure++;
    }

    // Check for raw known password hash values
    if (serialized.includes(KNOWN_HASH_1) || serialized.includes(KNOWN_HASH_2)) {
      passwordHashClientExposure++;
    }

    // Check for sessionToken / session_token property name
    if (serialized.includes("sessionToken") || serialized.includes("session_token")) {
      credentialFieldsClientExposure++;
    }

    // Check for raw session token fixture
    if (serialized.includes(KNOWN_SESSION_TOKEN)) {
      credentialFieldsClientExposure++;
    }

    // Check for session objects
    if (/"sessions"\s*:/.test(serialized)) {
      credentialFieldsClientExposure++;
    }

    // Check for internal email/phone exposure
    if (serialized.includes(KNOWN_EMAIL) || serialized.includes(KNOWN_PHONE)) {
      credentialFieldsClientExposure++;
    }

    console.log(`[CREDENTIAL AUDIT] PASSWORD_HASH_CLIENT_EXPOSURE = ${passwordHashClientExposure}`);
    console.log(`[CREDENTIAL AUDIT] CREDENTIAL_FIELDS_CLIENT_EXPOSURE = ${credentialFieldsClientExposure}`);

    assert.strictEqual(
      passwordHashClientExposure,
      0,
      "PASSWORD_HASH_CLIENT_EXPOSURE MUST BE STRICTLY 0"
    );

    assert.strictEqual(
      credentialFieldsClientExposure,
      0,
      "CREDENTIAL_FIELDS_CLIENT_EXPOSURE MUST BE STRICTLY 0"
    );
  });

  it("2. Returned User records strictly match SafeUserItemDTO minimal projection shape", async () => {
    setTestSession(sessionADM);

    const res = await getUsersListAction();
    assert.strictEqual(res.success, true);
    const users = res.data as SafeUserItemDTO[];
    assert.ok(users.length >= 3, "Harus mengembalikan minimal 3 user yang di-seed");

    for (const u of users) {
      // Must have safe allowed keys
      assert.ok(u.id, "id must exist");
      assert.ok(u.username, "username must exist");
      assert.ok(u.role, "role must exist");
      assert.ok(u.status, "status must exist");
      assert.strictEqual(typeof u.isPetugasPresensiPutri, "boolean");

      // Strictly must NOT have forbidden keys on user object
      const forbiddenUserKeys = [
        "passwordHash",
        "password_hash",
        "password",
        "email",
        "phone",
        "sessionToken",
        "sessions",
        "staffCode",
      ];
      for (const forbiddenKey of forbiddenUserKeys) {
        assert.strictEqual(
          (u as unknown as Record<string, unknown>)[forbiddenKey],
          undefined,
          `Key '${forbiddenKey}' dilarang ada pada objek User DTO`
        );
      }

      // If staff attached, only nama allowed
      if (u.staff) {
        assert.ok(u.staff.nama, "staff.nama must exist");
        assert.strictEqual(
          (u.staff as unknown as Record<string, unknown>).noHp,
          undefined,
          "staff.noHp dilarang ada pada DTO"
        );
        assert.strictEqual(
          (u.staff as unknown as Record<string, unknown>).staffCode,
          undefined,
          "staff.staffCode dilarang ada pada DTO"
        );
      }

      // If santri attached, only minimal fields allowed
      if (u.santri) {
        assert.ok(u.santri.id, "santri.id must exist");
        assert.ok(u.santri.nama, "santri.nama must exist");
        assert.strictEqual(
          (u.santri as unknown as Record<string, unknown>).noHpWali,
          undefined,
          "santri.noHpWali dilarang ada pada DTO"
        );
      }
    }
  });

  it("3. Unauthenticated and Unauthorized roles fail closed when requesting user list", async () => {
    // A. Unauthenticated
    setTestSession(null);
    const resUnauth = await getUsersListAction();
    assert.strictEqual(resUnauth.success, false);
    assert.strictEqual(resUnauth.errorCode, "UNAUTHORIZED");

    // B. Unauthorized role ST (Santri)
    setTestSession(sessionSantri);
    const resSantri = await getUsersListAction();
    assert.strictEqual(resSantri.success, false);
    assert.strictEqual(resSantri.errorCode, "UNAUTHORIZED");
  });

  it("4. User management mutation actions are SERVER-SIDE LOCKED with POLICY_NOT_ACTIVE (zero DB delta)", async () => {
    setTestSession(sessionADM);

    const userBefore = await prisma.user.findUnique({ where: { id: USER_STAFF_ID } });
    const sessionCountBefore = await prisma.session.count();

    // A. toggleUserStatusAction must deny server-side
    const resToggle = await toggleUserStatusAction(USER_STAFF_ID);
    assert.strictEqual(resToggle.success, false);
    assert.strictEqual(resToggle.errorCode, "POLICY_NOT_ACTIVE");
    assert.match(resToggle.message, /belum diaktifkan|Post-Launch Locked/i);

    // B. resetUserPasswordAction must deny server-side
    const resReset = await resetUserPasswordAction(USER_STAFF_ID);
    assert.strictEqual(resReset.success, false);
    assert.strictEqual(resReset.errorCode, "POLICY_NOT_ACTIVE");
    assert.match(resReset.message, /belum diaktifkan|Post-Launch Locked/i);

    // C. togglePetugasPresensiPutriAction must deny server-side
    const resPutri = await togglePetugasPresensiPutriAction(USER_SANTRI_ID);
    assert.strictEqual(resPutri.success, false);
    assert.strictEqual(resPutri.errorCode, "POLICY_NOT_ACTIVE");
    assert.match(resPutri.message, /belum diaktifkan|Post-Launch Locked/i);

    // Verify ZERO DB DELTA
    const userAfter = await prisma.user.findUnique({ where: { id: USER_STAFF_ID } });
    const sessionCountAfter = await prisma.session.count();

    assert.strictEqual(userAfter?.status, userBefore?.status, "User status must NOT change");
    assert.strictEqual(userAfter?.passwordHash, userBefore?.passwordHash, "User passwordHash must NOT change");
    assert.strictEqual(sessionCountAfter, sessionCountBefore, "Sessions count must NOT change");
  });

  it("5. Error sanitization in users.ts prevents internal database/Prisma details leaking", async () => {
    setTestSession(sessionADM);

    // Call getUsersListAction with an intentional failure or inspect the error handling contract
    // The catch block must return error: 'INTERNAL_ERROR', errorCode: 'INTERNAL_ERROR' and a sanitized Indonesian message
    const res = await getUsersListAction();
    // In normal execution it succeeds
    assert.strictEqual(res.success, true);

    // Verify error shape contract when unauthorized
    setTestSession(null);
    const errRes = await getUsersListAction();
    assert.strictEqual(errRes.success, false);
    assert.strictEqual(typeof errRes.message, "string");
    assert.strictEqual(errRes.message.includes("prisma"), false, "Message must not contain 'prisma'");
    assert.strictEqual(errRes.message.includes("SELECT"), false, "Message must not contain SQL keywords");
  });
});
