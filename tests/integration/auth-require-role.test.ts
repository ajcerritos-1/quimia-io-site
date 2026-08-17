/**
 * Story 1.3 Task 3 — `requireRole()`, the general multi-role guard AC 7
 * requires to be proven independently (today's codebase has no production
 * call site needing more than one allowed role, but the mechanism must work
 * for any future module that does). Real ephemeral Neon branch, real signed
 * session cookies — no mocks, same pattern as `auth-require-admin.test.ts`.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runWithContext } from "../../src/shared/context/request-context";

const PASSWORD = "Correct-Horse-Battery-Staple-1!";

let owner: Client;
let tenantId: string;

async function seedUser(
  role: "admin" | "recepcionista" | "quimico",
): Promise<{ userId: string; email: string }> {
  const userId = `user-reqrole-${randomUUID()}`;
  const email = `reqrole-${randomUUID()}@example.com`;
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [userId, tenantId, email, `reqrole${randomUUID().slice(0, 8)}`, "Req Role User", role],
  );
  const hash = await hashPassword(PASSWORD);
  await owner.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-reqrole-${randomUUID()}`, userId, userId, hash],
  );
  return { userId, email };
}

async function signInAndBuildHeaders(user: { email: string }): Promise<Headers> {
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
  tenantId = `tenant-reqrole-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-reqrole-${randomUUID()}`, "Req Role Lab"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe("requireRole (Task 2/3 — general multi-role guard, AC 2/3/7)", () => {
  it("allows an admin actor through to fn when admin is in the allowed-roles list", async () => {
    const admin = await seedUser("admin");
    const requestHeaders = await signInAndBuildHeaders(admin);

    const { requireRole } = await import(
      "../../src/modules/auth/server/require-role"
    );
    const { UserRole } = await import("../../src/shared/db");

    const result = await requireRole(
      { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      [UserRole.admin, UserRole.quimico],
      async (actor) => actor.userId,
      { entity: "TestEntity", action: "TEST_ACTION_DENIED", attemptedAction: "TEST_ACTION" },
    );

    expect(result).toBe(admin.userId);
  });

  it("allows a quimico actor through to fn when quimico is in the allowed-roles list", async () => {
    const quimico = await seedUser("quimico");
    const requestHeaders = await signInAndBuildHeaders(quimico);

    const { requireRole } = await import(
      "../../src/modules/auth/server/require-role"
    );
    const { UserRole } = await import("../../src/shared/db");

    const result = await requireRole(
      { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      [UserRole.admin, UserRole.quimico],
      async (actor) => actor.userId,
      { entity: "TestEntity", action: "TEST_ACTION_DENIED", attemptedAction: "TEST_ACTION" },
    );

    expect(result).toBe(quimico.userId);
  });

  it("denies a recepcionista actor (not in the allowed-roles list) with a 403 AppError, writes exactly one AuditLog row, and never invokes fn", async () => {
    const recepcionista = await seedUser("recepcionista");
    const requestHeaders = await signInAndBuildHeaders(recepcionista);

    const { requireRole } = await import(
      "../../src/modules/auth/server/require-role"
    );
    const { UserRole } = await import("../../src/shared/db");

    let fnCalled = false;
    await expect(
      requireRole(
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
        [UserRole.admin, UserRole.quimico],
        async () => {
          fnCalled = true;
          return "unreachable";
        },
        { entity: "TestEntity", action: "TEST_ACTION_DENIED", attemptedAction: "TEST_ACTION" },
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect(fnCalled).toBe(false);

    const { rows } = await owner.query(
      'SELECT entity, action, "entityId", "actorUserId", "tenantId", after FROM "audit_log" WHERE "actorUserId" = $1',
      [recepcionista.userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity: "TestEntity",
      action: "TEST_ACTION_DENIED",
      entityId: recepcionista.userId,
      actorUserId: recepcionista.userId,
      tenantId,
      after: { attemptedAction: "TEST_ACTION" },
    });
  });
});
