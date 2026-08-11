/**
 * Phase 6.5 — `src/middleware.ts` rejects a session token minted for one
 * tenant when it is replayed against a DIFFERENT tenant's subdomain
 * (design.md "Data Flow", D2 bonus). Signs in for real (via
 * `auth.api.signInEmail`, capturing the real signed session cookie Better
 * Auth sets), then calls the exported `middleware` function directly with
 * a `NextRequest` carrying that cookie against the WRONG host.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { NextRequest } from "next/server";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runWithContext } from "../../src/shared/context/request-context";

const PASSWORD = "Correct-Horse-Battery-Staple-1!";

interface SeededTenant {
  tenantId: string;
  slug: string;
}

interface SeededUser {
  userId: string;
  email: string;
}

let owner: Client;

async function seedTenant(client: Client): Promise<SeededTenant> {
  const tenantId = `tenant-replay-${randomUUID()}`;
  const slug = `lab-replay-${randomUUID()}`;
  await client.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, slug, "Replay Lab"],
  );
  return { tenantId, slug };
}

async function seedActiveUser(
  client: Client,
  tenantId: string,
): Promise<SeededUser> {
  const userId = `user-replay-${randomUUID()}`;
  const email = `replay-${randomUUID()}@example.com`;
  await client.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'admin', now())`,
    [userId, tenantId, email, `replayuser${randomUUID().slice(0, 8)}`, "Replay User"],
  );
  const hash = await hashPassword(PASSWORD);
  await client.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-replay-${randomUUID()}`, userId, userId, hash],
  );
  return { userId, email };
}

/** Signs in for real and returns the `Cookie:` header value a browser would send back. */
async function signInAndGetCookieHeader(
  tenant: SeededTenant,
  user: SeededUser,
): Promise<string> {
  const { auth } = await import("../../src/modules/auth/server/auth");
  const { headers } = await runWithContext(
    {
      requestId: `req-signin-${randomUUID()}`,
      tenant: { tenantId: tenant.tenantId, role: "anonymous" },
    },
    () =>
      auth.api.signInEmail({
        body: { email: user.email, password: PASSWORD },
        returnHeaders: true,
      }),
  );

  const cookies = headers.getSetCookie();
  expect(cookies.length).toBeGreaterThan(0);
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function buildRequest(host: string, cookieHeader: string): NextRequest {
  return new NextRequest("https://example.test/dashboard", {
    headers: { host, cookie: cookieHeader },
  });
}

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
});

afterAll(async () => {
  await owner.end();
});

describe("middleware — cross-tenant session replay (D2 bonus, AC-4)", () => {
  it("rejects with 401 when a tenant-A session is replayed against tenant B's host", async () => {
    const tenantA = await seedTenant(owner);
    const tenantB = await seedTenant(owner);
    const userA = await seedActiveUser(owner, tenantA.tenantId);

    const cookieHeader = await signInAndGetCookieHeader(tenantA, userA);

    const { middleware } = await import("../../src/middleware");
    const response = await middleware(
      buildRequest(`${tenantB.slug}.quimiaio.com`, cookieHeader),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid credentials.",
      },
    });
  });

  it("passes through when the session is presented against its OWN tenant's host", async () => {
    const tenantA = await seedTenant(owner);
    const userA = await seedActiveUser(owner, tenantA.tenantId);

    const cookieHeader = await signInAndGetCookieHeader(tenantA, userA);

    const { middleware } = await import("../../src/middleware");
    const response = await middleware(
      buildRequest(`${tenantA.slug}.quimiaio.com`, cookieHeader),
    );

    expect(response.status).not.toBe(401);
    // NextResponse.next({ request: { headers } }) does not surface the
    // modified headers on the RESPONSE directly — Next.js's own middleware
    // runtime reads them back off `x-middleware-request-*` (and the
    // `x-middleware-override-headers` index) to reconstruct the request it
    // hands to the next stage. See next/dist/server/web/spec-extension/
    // response.js's `handleMiddlewareField`.
    expect(response.headers.get("x-middleware-override-headers")).toContain(
      "x-tenant-id",
    );
    expect(response.headers.get("x-middleware-request-x-tenant-id")).toBe(
      tenantA.tenantId,
    );
  });

  it("passes through when no session cookie is present at all (anonymous request)", async () => {
    const tenantA = await seedTenant(owner);

    const { middleware } = await import("../../src/middleware");
    const response = await middleware(
      buildRequest(`${tenantA.slug}.quimiaio.com`, ""),
    );

    expect(response.status).not.toBe(401);
    expect(response.headers.get("x-middleware-request-x-tenant-id")).toBe(
      tenantA.tenantId,
    );
  });
});
