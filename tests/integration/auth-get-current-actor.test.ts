/**
 * Story 1.2 Task 3 — `getCurrentActor()` is the first helper that turns "an
 * incoming request with a session cookie" into a resolved `{tenantId,
 * userId, role}` for a Server Action to act as. Two things nothing before
 * this story ever needed: (1) re-checking `isActive` for an EXISTING session
 * (Story 1.1's `databaseHooks.session.create.before` only rejects at
 * session-creation time), and (2) re-entering `runWithContext` a second time
 * with the REAL resolved role so everything downstream (the caller's own
 * callback) runs under it. Real ephemeral Neon branch, real signed session
 * cookies via `auth.api.signInEmail` — no mocks.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runWithContext, getContext } from "../../src/shared/context/request-context";

const PASSWORD = "Correct-Horse-Battery-Staple-1!";

interface SeededTenant {
  tenantId: string;
}

interface SeededUser {
  userId: string;
  email: string;
}

let owner: Client;
let tenant: SeededTenant;

async function seedTenant(client: Client): Promise<SeededTenant> {
  const tenantId = `tenant-actor-${randomUUID()}`;
  await client.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-actor-${randomUUID()}`, "Actor Lab"],
  );
  return { tenantId };
}

async function seedUser(
  client: Client,
  tenantId: string,
  role: "admin" | "recepcionista" | "quimico" = "admin",
): Promise<SeededUser> {
  const userId = `user-actor-${randomUUID()}`;
  const email = `actor-${randomUUID()}@example.com`;
  await client.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [userId, tenantId, email, `actoruser${randomUUID().slice(0, 8)}`, "Actor User", role],
  );
  const hash = await hashPassword(PASSWORD);
  await client.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-actor-${randomUUID()}`, userId, userId, hash],
  );
  return { userId, email };
}

/** Signs in for real, returns a Fetch API `Headers` carrying the session cookie. */
async function signInAndBuildHeaders(
  tenantId: string,
  user: SeededUser,
): Promise<Headers> {
  const { auth } = await import("../../src/modules/auth/server/auth");
  const { headers: setHeaders } = await runWithContext(
    {
      requestId: `req-signin-${randomUUID()}`,
      tenant: { tenantId, role: "anonymous" },
    },
    () =>
      auth.api.signInEmail({
        body: { email: user.email, password: PASSWORD },
        returnHeaders: true,
      }),
  );
  const cookieHeader = setHeaders
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  return new Headers({ cookie: cookieHeader });
}

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenant = await seedTenant(owner);
});

afterAll(async () => {
  await owner.end();
});

describe("getCurrentActor (Task 3 — session/role resolution)", () => {
  it("resolves {tenantId, userId, role} for a valid, active session and runs fn under the REAL role context", async () => {
    const user = await seedUser(owner, tenant.tenantId, "admin");
    const requestHeaders = await signInAndBuildHeaders(tenant.tenantId, user);

    const { getCurrentActor } = await import(
      "../../src/modules/auth/server/get-current-actor"
    );
    const requestId = `req-actor-${randomUUID()}`;

    const result = await getCurrentActor(
      { headers: requestHeaders, tenantId: tenant.tenantId, requestId },
      async (actor) => {
        expect(getContext()?.tenant.role).toBe("admin");
        expect(getContext()?.tenant.tenantId).toBe(tenant.tenantId);
        return actor;
      },
    );

    expect(result).toEqual({
      tenantId: tenant.tenantId,
      userId: user.userId,
      role: "admin",
    });
  });

  it("resolves a non-admin role correctly (role is read from the DB, not hardcoded)", async () => {
    const user = await seedUser(owner, tenant.tenantId, "quimico");
    const requestHeaders = await signInAndBuildHeaders(tenant.tenantId, user);

    const { getCurrentActor } = await import(
      "../../src/modules/auth/server/get-current-actor"
    );

    const result = await getCurrentActor(
      { headers: requestHeaders, tenantId: tenant.tenantId, requestId: `req-${randomUUID()}` },
      async (actor) => actor,
    );

    expect(result.role).toBe("quimico");
  });

  it("rejects with the generic auth error when no session cookie is present", async () => {
    const { getCurrentActor } = await import(
      "../../src/modules/auth/server/get-current-actor"
    );

    await expect(
      getCurrentActor(
        {
          headers: new Headers(),
          tenantId: tenant.tenantId,
          requestId: `req-${randomUUID()}`,
        },
        async (actor) => actor,
      ),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS", status: 401 });
  });

  it("rejects a currently-logged-in user who is deactivated MID-SESSION (not just at next sign-in)", async () => {
    const user = await seedUser(owner, tenant.tenantId, "admin");
    const requestHeaders = await signInAndBuildHeaders(tenant.tenantId, user);

    // Deactivate AFTER the session already exists — Story 1.1's
    // databaseHooks.session.create.before never re-runs for an existing
    // session; this is the check Task 3 adds.
    await owner.query('UPDATE "user" SET "isActive" = false WHERE id = $1', [
      user.userId,
    ]);

    const { getCurrentActor } = await import(
      "../../src/modules/auth/server/get-current-actor"
    );

    await expect(
      getCurrentActor(
        { headers: requestHeaders, tenantId: tenant.tenantId, requestId: `req-${randomUUID()}` },
        async (actor) => actor,
      ),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS", status: 401 });
  });
});
