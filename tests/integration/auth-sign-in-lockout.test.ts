/**
 * Story 1.4 Task 6 (AC 2) — account lockout after repeated failed sign-in
 * attempts. Sibling file to `auth-sign-in.test.ts` (Story 1.1) rather than an
 * extension of it, since that file is already sizeable — same seeding
 * conventions, same real-ephemeral-Neon-branch posture (never a mocked
 * client for anything touching session/credential behavior).
 *
 * The single most important invariant under test here: a locked account's
 * sign-in failure must be BYTE-IDENTICAL to every other failure case in
 * `sign-in.action.ts` (Story 1.1 AC-4's anti-enumeration envelope) — the
 * lockout event is signaled ONLY via an `AuditLog` row, never a distinct
 * user-facing message.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

const PASSWORD = "Correct-Horse-Battery-Staple-1!";
const WRONG_PASSWORD = "totally-different-password-99";
const GENERIC_FAILURE = {
  ok: false,
  code: "AUTH_INVALID_CREDENTIALS",
  message: "Invalid credentials.",
};

interface SeededUser {
  tenantId: string;
  userId: string;
  email: string;
}

let owner: Client;

async function seedTenant(client: Client): Promise<string> {
  const tenantId = `tenant-lockout-${randomUUID()}`;
  await client.query(
    `INSERT INTO "tenant" (id, slug, name, "isActive", "updatedAt")
     VALUES ($1, $2, $3, true, now())`,
    [tenantId, `lab-lockout-${randomUUID()}`, "Lockout Lab"],
  );
  return tenantId;
}

async function seedUser(
  client: Client,
  tenantId: string,
  opts: { isActive?: boolean } = {},
): Promise<SeededUser> {
  const userId = `user-lockout-${randomUUID()}`;
  const email = `lockout-${randomUUID()}@example.com`;
  const nickname = `lockoutuser${randomUUID().slice(0, 8)}`;
  await client.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'admin', $6, now())`,
    [userId, tenantId, email, nickname, "Lockout User", opts.isActive ?? true],
  );
  const hash = await hashPassword(PASSWORD);
  await client.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-lockout-${randomUUID()}`, userId, userId, hash],
  );
  return { tenantId, userId, email };
}

async function getUserLockoutState(userId: string) {
  const { rows } = await owner.query(
    'SELECT "failedLoginAttempts", "lockedUntil" FROM "user" WHERE id = $1',
    [userId],
  );
  return rows[0] as { failedLoginAttempts: number; lockedUntil: Date | null };
}

async function getLockAuditRows(userId: string) {
  const { rows } = await owner.query(
    'SELECT action, "entityId", "actorUserId" FROM "audit_log" WHERE "entityId" = $1 AND action = $2',
    [userId, "USER_ACCOUNT_LOCKED"],
  );
  return rows;
}

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
});

afterAll(async () => {
  await owner.end();
});

describe("signIn — account lockout (Story 1.4 Task 5/6, AC 2)", () => {
  it("locks the account after MAX_FAILED_LOGIN_ATTEMPTS wrong-password attempts, audit-logs exactly once, and stays inside the generic-failure envelope", async () => {
    const tenantId = await seedTenant(owner);
    const user = await seedUser(owner, tenantId);

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const { MAX_FAILED_LOGIN_ATTEMPTS } = await import(
      "../../src/modules/auth/server/account-lockout"
    );

    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      const result = await signIn(
        { identifier: user.email, password: WRONG_PASSWORD },
        { tenantId, isActive: true },
        `req-${randomUUID()}`,
      );
      expect(result).toEqual(GENERIC_FAILURE);
    }

    const state = await getUserLockoutState(user.userId);
    expect(state.failedLoginAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS);
    expect(state.lockedUntil).not.toBeNull();
    expect(new Date(state.lockedUntil as Date).getTime()).toBeGreaterThan(Date.now());

    const auditRows = await getLockAuditRows(user.userId);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: "USER_ACCOUNT_LOCKED",
      entityId: user.userId,
      actorUserId: user.userId,
    });
  }, 60_000);

  it("still rejects a subsequent sign-in with the CORRECT password while locked, with the identical generic failure", async () => {
    const tenantId = await seedTenant(owner);
    const user = await seedUser(owner, tenantId);

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const { MAX_FAILED_LOGIN_ATTEMPTS } = await import(
      "../../src/modules/auth/server/account-lockout"
    );

    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS; attempt += 1) {
      await signIn(
        { identifier: user.email, password: WRONG_PASSWORD },
        { tenantId, isActive: true },
        `req-${randomUUID()}`,
      );
    }

    const result = await signIn(
      { identifier: user.email, password: PASSWORD },
      { tenantId, isActive: true },
      `req-${randomUUID()}`,
    );
    expect(result).toEqual(GENERIC_FAILURE);
  }, 60_000);

  it("a successful sign-in resets failedLoginAttempts back to 0 after some (but not all) failed attempts", async () => {
    const tenantId = await seedTenant(owner);
    const user = await seedUser(owner, tenantId);

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const { MAX_FAILED_LOGIN_ATTEMPTS } = await import(
      "../../src/modules/auth/server/account-lockout"
    );

    // Fewer than the threshold, so the account never locks.
    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS - 1; attempt += 1) {
      await signIn(
        { identifier: user.email, password: WRONG_PASSWORD },
        { tenantId, isActive: true },
        `req-${randomUUID()}`,
      );
    }

    const midState = await getUserLockoutState(user.userId);
    expect(midState.failedLoginAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS - 1);
    expect(midState.lockedUntil).toBeNull();

    const result = await signIn(
      { identifier: user.email, password: PASSWORD },
      { tenantId, isActive: true },
      `req-${randomUUID()}`,
    );
    expect(result.ok).toBe(true);

    const finalState = await getUserLockoutState(user.userId);
    expect(finalState.failedLoginAttempts).toBe(0);
    expect(finalState.lockedUntil).toBeNull();
  }, 60_000);

  it("a deactivated user's failed sign-in attempts do NOT increment failedLoginAttempts", async () => {
    const tenantId = await seedTenant(owner);
    const user = await seedUser(owner, tenantId, { isActive: false });

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");

    const result = await signIn(
      { identifier: user.email, password: WRONG_PASSWORD },
      { tenantId, isActive: true },
      `req-${randomUUID()}`,
    );
    expect(result).toEqual(GENERIC_FAILURE);

    const state = await getUserLockoutState(user.userId);
    expect(state.failedLoginAttempts).toBe(0);
    expect(state.lockedUntil).toBeNull();
  });

  it("fewer-than-threshold failed attempts do not set lockedUntil and do not write an AuditLog row", async () => {
    const tenantId = await seedTenant(owner);
    const user = await seedUser(owner, tenantId);

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const { MAX_FAILED_LOGIN_ATTEMPTS } = await import(
      "../../src/modules/auth/server/account-lockout"
    );

    for (let attempt = 0; attempt < MAX_FAILED_LOGIN_ATTEMPTS - 1; attempt += 1) {
      const result = await signIn(
        { identifier: user.email, password: WRONG_PASSWORD },
        { tenantId, isActive: true },
        `req-${randomUUID()}`,
      );
      expect(result).toEqual(GENERIC_FAILURE);
    }

    const state = await getUserLockoutState(user.userId);
    expect(state.failedLoginAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS - 1);
    expect(state.lockedUntil).toBeNull();

    const auditRows = await getLockAuditRows(user.userId);
    expect(auditRows).toHaveLength(0);
  }, 60_000);
});
