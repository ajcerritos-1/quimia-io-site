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

let owner: Client;

async function seedTenantAndUser(client: Client) {
  const tenantId = `tenant-route-${randomUUID()}`;
  const userId = `user-route-${randomUUID()}`;
  const email = `route-${randomUUID()}@example.com`;
  await client.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-route-${randomUUID()}`, "Route Mount Lab"],
  );
  await client.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'admin', now())`,
    [userId, tenantId, email, `routeuser${randomUUID().slice(0, 8)}`, "Route User"],
  );
  const hash = await hashPassword(PASSWORD);
  await client.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-route-${randomUUID()}`, userId, userId, hash],
  );
  return { tenantId, userId, email };
}

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
});
