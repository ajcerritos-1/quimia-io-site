/**
 * Phase 6.2/6.3/6.4 — `signIn()` (`src/modules/auth/server/sign-in.action.ts`)
 * is the ONE entry point for credential sign-in (design.md "Data Flow").
 * Testing through it — rather than calling `auth.api.signInEmail` directly —
 * is the most faithful test of AC-4: wrong password, inactive user, inactive
 * tenant, and unknown identifier all resolve to the byte-for-byte identical
 * generic failure, because they all funnel through this one function.
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
  nickname: string;
}

let owner: Client;

async function seedTenant(
  client: Client,
  opts: { isActive?: boolean } = {},
): Promise<string> {
  const tenantId = `tenant-signin-${randomUUID()}`;
  await client.query(
    `INSERT INTO "tenant" (id, slug, name, "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, now())`,
    [tenantId, `lab-signin-${randomUUID()}`, "Sign-in Lab", opts.isActive ?? true],
  );
  return tenantId;
}

async function seedUser(
  client: Client,
  tenantId: string,
  opts: { email?: string; isActive?: boolean } = {},
): Promise<SeededUser> {
  const userId = `user-signin-${randomUUID()}`;
  const email = opts.email ?? `signin-${randomUUID()}@example.com`;
  const nickname = `signinuser${randomUUID().slice(0, 8)}`;
  await client.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'admin', $6, now())`,
    [userId, tenantId, email, nickname, "Sign-in User", opts.isActive ?? true],
  );
  const hash = await hashPassword(PASSWORD);
  await client.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-signin-${randomUUID()}`, userId, userId, hash],
  );
  return { tenantId, userId, email, nickname };
}

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
});

afterAll(async () => {
  await owner.end();
});

describe("signIn — generic failure (AC-4, D7, D11)", () => {
  it("valid credentials (email) succeed and return a session token", async () => {
    const tenantId = await seedTenant(owner);
    const user = await seedUser(owner, tenantId);

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const result = await signIn(
      { identifier: user.email, password: PASSWORD },
      { tenantId, isActive: true },
      `req-${randomUUID()}`,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.userId).toBe(user.userId);
    }
  });

  it("valid credentials (nickname) succeed — resolved to email inside a scoped tx (D7)", async () => {
    const tenantId = await seedTenant(owner);
    const user = await seedUser(owner, tenantId);

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const result = await signIn(
      { identifier: user.nickname, password: PASSWORD },
      { tenantId, isActive: true },
      `req-${randomUUID()}`,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe(user.userId);
    }
  });

  it("wrong password returns the generic failure", async () => {
    const tenantId = await seedTenant(owner);
    const user = await seedUser(owner, tenantId);

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const result = await signIn(
      { identifier: user.email, password: WRONG_PASSWORD },
      { tenantId, isActive: true },
      `req-${randomUUID()}`,
    );

    expect(result).toEqual(GENERIC_FAILURE);
  });

  it("inactive user with a correct password returns the byte-for-byte identical generic failure (D11)", async () => {
    const tenantId = await seedTenant(owner);
    const user = await seedUser(owner, tenantId, { isActive: false });

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const result = await signIn(
      { identifier: user.email, password: PASSWORD },
      { tenantId, isActive: true },
      `req-${randomUUID()}`,
    );

    expect(result).toEqual(GENERIC_FAILURE);
  });

  it("inactive tenant with otherwise-valid credentials returns the identical generic failure", async () => {
    const tenantId = await seedTenant(owner, { isActive: false });
    const user = await seedUser(owner, tenantId);

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const result = await signIn(
      { identifier: user.email, password: PASSWORD },
      { tenantId, isActive: false },
      `req-${randomUUID()}`,
    );

    expect(result).toEqual(GENERIC_FAILURE);
  });

  it("unknown identifier returns the identical generic failure (dummy verify runs, no timing oracle)", async () => {
    const tenantId = await seedTenant(owner);

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const result = await signIn(
      {
        identifier: `no-such-user-${randomUUID()}@example.com`,
        password: PASSWORD,
      },
      { tenantId, isActive: true },
      `req-${randomUUID()}`,
    );

    expect(result).toEqual(GENERIC_FAILURE);
  });

  it("unresolved tenant (null, unknown subdomain) returns the identical generic failure", async () => {
    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const result = await signIn(
      { identifier: "whoever@example.com", password: PASSWORD },
      null,
      `req-${randomUUID()}`,
    );

    expect(result).toEqual(GENERIC_FAILURE);
  });
});

describe("signIn — multi-tenant email uniqueness (6.4, D4)", () => {
  it("the same email succeeds independently in two different tenants", async () => {
    const tenantA = await seedTenant(owner);
    const tenantB = await seedTenant(owner);
    const sharedEmail = `shared-${randomUUID()}@example.com`;
    const userA = await seedUser(owner, tenantA, { email: sharedEmail });
    const userB = await seedUser(owner, tenantB, { email: sharedEmail });

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");

    const resultA = await signIn(
      { identifier: sharedEmail, password: PASSWORD },
      { tenantId: tenantA, isActive: true },
      `req-${randomUUID()}`,
    );
    const resultB = await signIn(
      { identifier: sharedEmail, password: PASSWORD },
      { tenantId: tenantB, isActive: true },
      `req-${randomUUID()}`,
    );

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(resultA.userId).toBe(userA.userId);
      expect(resultB.userId).toBe(userB.userId);
      expect(resultA.userId).not.toBe(resultB.userId);
    }
  });
});
