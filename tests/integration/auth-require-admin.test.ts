/**
 * Story 1.2 Task 3 — `requireAdmin()`, a narrow guard on top of
 * `getCurrentActor()`. AC-4: a non-admin caller is rejected with a 403 AND
 * the denied attempt itself is logged to `AuditLog` BEFORE the guard throws
 * — "the attempt itself is logged", not just "the action was blocked".
 * Real ephemeral Neon branch, real signed session cookies — no mocks.
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
  const userId = `user-reqadmin-${randomUUID()}`;
  const email = `reqadmin-${randomUUID()}@example.com`;
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [userId, tenantId, email, `reqadmin${randomUUID().slice(0, 8)}`, "Req Admin User", role],
  );
  const hash = await hashPassword(PASSWORD);
  await owner.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-reqadmin-${randomUUID()}`, userId, userId, hash],
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
  tenantId = `tenant-reqadmin-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-reqadmin-${randomUUID()}`, "Req Admin Lab"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe("requireAdmin (Task 3 — admin-only guard, AC-4)", () => {
  it("allows an admin actor through to fn", async () => {
    const admin = await seedUser("admin");
    const requestHeaders = await signInAndBuildHeaders(admin);

    const { requireAdmin } = await import(
      "../../src/modules/auth/server/require-admin"
    );

    const result = await requireAdmin(
      { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      async (actor) => actor.userId,
    );

    expect(result).toBe(admin.userId);
  });

  it("rejects a non-admin (recepcionista) caller with a 403 AppError", async () => {
    const recepcionista = await seedUser("recepcionista");
    const requestHeaders = await signInAndBuildHeaders(recepcionista);

    const { requireAdmin } = await import(
      "../../src/modules/auth/server/require-admin"
    );

    await expect(
      requireAdmin(
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
        async () => "should not run",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("writes an AuditLog row for the denied attempt BEFORE throwing", async () => {
    const quimico = await seedUser("quimico");
    const requestHeaders = await signInAndBuildHeaders(quimico);

    const { requireAdmin } = await import(
      "../../src/modules/auth/server/require-admin"
    );

    await expect(
      requireAdmin(
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
        async () => "should not run",
      ),
    ).rejects.toThrow();

    const { rows } = await owner.query(
      'SELECT action, "actorUserId", "tenantId" FROM "audit_log" WHERE "actorUserId" = $1',
      [quimico.userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "USER_ADMIN_ACTION_DENIED",
      actorUserId: quimico.userId,
      tenantId,
    });
  });

  it("records the attempted action and target in the denied AuditLog row when options are given (code-review follow-up)", async () => {
    const quimico = await seedUser("quimico");
    const target = await seedUser("recepcionista");
    const requestHeaders = await signInAndBuildHeaders(quimico);

    const { requireAdmin } = await import(
      "../../src/modules/auth/server/require-admin"
    );

    await expect(
      requireAdmin(
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
        async () => "should not run",
        { attemptedAction: "USER_ROLE_CHANGE", targetUserId: target.userId },
      ),
    ).rejects.toMatchObject({ status: 403 });

    const { rows } = await owner.query(
      'SELECT action, "entityId", "actorUserId", after FROM "audit_log" WHERE "actorUserId" = $1',
      [quimico.userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "USER_ADMIN_ACTION_DENIED",
      entityId: target.userId,
      actorUserId: quimico.userId,
      after: { attemptedAction: "USER_ROLE_CHANGE" },
    });
  });

  it("never invokes fn for a denied caller", async () => {
    const recepcionista = await seedUser("recepcionista");
    const requestHeaders = await signInAndBuildHeaders(recepcionista);

    const { requireAdmin } = await import(
      "../../src/modules/auth/server/require-admin"
    );

    let fnCalled = false;
    await expect(
      requireAdmin(
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
        async () => {
          fnCalled = true;
          return "unreachable";
        },
      ),
    ).rejects.toThrow();

    expect(fnCalled).toBe(false);
  });
});
