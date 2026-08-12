/**
 * Phase 6.7 — `src/app/api/auth/[...all]/route.ts` mounts Better Auth's
 * handler, wrapped in `runWithContext` using the `x-tenant-id`/
 * `x-request-id` headers middleware sets (D2). Confirms the mounted GET/POST
 * exports actually delegate to Better Auth end-to-end against a real Neon
 * branch — a full HTTP-shaped round trip through `auth.handler`, not just a
 * direct `auth.api.*` call like the other Phase 6 tests use.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

const PASSWORD = "Correct-Horse-Battery-Staple-1!";
const WRONG_PASSWORD = "totally-different-password-99";

let owner: Client;

async function seedTenantAndUser(
  client: Client,
  opts: { isActive?: boolean } = {},
) {
  const tenantId = `tenant-route-${randomUUID()}`;
  const userId = `user-route-${randomUUID()}`;
  const email = `route-${randomUUID()}@example.com`;
  await client.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-route-${randomUUID()}`, "Route Mount Lab"],
  );
  await client.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'admin', $6, now())`,
    [
      userId,
      tenantId,
      email,
      `routeuser${randomUUID().slice(0, 8)}`,
      "Route User",
      opts.isActive ?? true,
    ],
  );
  const hash = await hashPassword(PASSWORD);
  await client.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-route-${randomUUID()}`, userId, userId, hash],
  );
  return { tenantId, userId, email };
}

function buildSignInRequest(
  tenantId: string,
  body: { email: string; password: string },
): Request {
  return new Request("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-id": tenantId,
      "x-request-id": `req-route-${randomUUID()}`,
    },
    body: JSON.stringify(body),
  });
}

const AC4_GENERIC_ENVELOPE = {
  error: {
    code: "AUTH_INVALID_CREDENTIALS",
    message: "Invalid credentials.",
  },
};

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
});

afterAll(async () => {
  await owner.end();
});

describe("GET/POST /api/auth/[...all] — Better Auth handler mount", () => {
  it("POST /api/auth/sign-in/email delegates to Better Auth and signs in for real", async () => {
    const { tenantId, userId, email } = await seedTenantAndUser(owner);
    const { POST } = await import("../../src/app/api/auth/[...all]/route");

    const request = new Request(
      "http://localhost:3000/api/auth/sign-in/email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-id": tenantId,
          "x-request-id": `req-route-${randomUUID()}`,
        },
        body: JSON.stringify({ email, password: PASSWORD }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(userId);
    expect(typeof body.token).toBe("string");
    expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
  });

  it("GET /api/auth/get-session returns null when no session cookie is present", async () => {
    const { tenantId } = await seedTenantAndUser(owner);
    const { GET } = await import("../../src/app/api/auth/[...all]/route");

    const request = new Request(
      "http://localhost:3000/api/auth/get-session",
      {
        method: "GET",
        headers: {
          "x-tenant-id": tenantId,
          "x-request-id": `req-route-${randomUUID()}`,
        },
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toBeNull();
  });

  it("wrong password and an inactive account return byte-for-byte identical AC-4 bodies (CRITICAL-1)", async () => {
    const { tenantId: wrongPwTenantId, email: wrongPwEmail } =
      await seedTenantAndUser(owner);
    const { tenantId: inactiveTenantId, email: inactiveEmail } =
      await seedTenantAndUser(owner, { isActive: false });
    const { POST } = await import("../../src/app/api/auth/[...all]/route");

    const wrongPasswordResponse = await POST(
      buildSignInRequest(wrongPwTenantId, {
        email: wrongPwEmail,
        password: WRONG_PASSWORD,
      }),
    );
    const inactiveUserResponse = await POST(
      buildSignInRequest(inactiveTenantId, {
        email: inactiveEmail,
        password: PASSWORD,
      }),
    );

    expect(wrongPasswordResponse.status).toBe(401);
    expect(inactiveUserResponse.status).toBe(401);

    const wrongPasswordBody = await wrongPasswordResponse.json();
    const inactiveUserBody = await inactiveUserResponse.json();

    // The account-state oracle AC-4 forbids: an attacker MUST NOT be able to
    // tell "wrong password" apart from "account exists but is deactivated"
    // by inspecting the response body of this publicly-reachable route.
    expect(wrongPasswordBody).toEqual(AC4_GENERIC_ENVELOPE);
    expect(inactiveUserBody).toEqual(AC4_GENERIC_ENVELOPE);
    expect(JSON.stringify(wrongPasswordBody)).toBe(
      JSON.stringify(inactiveUserBody),
    );
  });

  it("an unknown email also returns the identical AC-4 body (CRITICAL-1)", async () => {
    const { tenantId } = await seedTenantAndUser(owner);
    const { POST } = await import("../../src/app/api/auth/[...all]/route");

    const response = await POST(
      buildSignInRequest(tenantId, {
        email: `no-such-user-${randomUUID()}@example.com`,
        password: PASSWORD,
      }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual(AC4_GENERIC_ENVELOPE);
  });
});
