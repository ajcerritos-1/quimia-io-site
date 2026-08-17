/**
 * Story 1.2 Task 6 — `deactivateUser()`. Self-deactivation guard (AC 5)
 * checked BEFORE touching the database. One `transaction()` call sets
 * `User.isActive = false`, deletes all of that user's `Session` rows
 * (active revocation, AC 2 — not a passive next-request check), and writes
 * the `AuditLog` row (`USER_DEACTIVATED`).
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
  const userId = `user-deactivate-${randomUUID()}`;
  const email = `deactivate-${randomUUID()}@example.com`;
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [userId, tenantId, email, `deactivate${randomUUID().slice(0, 8)}`, "Deactivate User", role],
  );
  const hash = await hashPassword(PASSWORD);
  await owner.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-deactivate-${randomUUID()}`, userId, userId, hash],
  );
  return { userId, email };
}

async function signInAndBuildHeaders(email: string): Promise<Headers> {
  const { auth } = await import("../../src/modules/auth/server/auth");
  const { headers: setHeaders } = await runWithContext(
    { requestId: `req-signin-${randomUUID()}`, tenant: { tenantId, role: "anonymous" } },
    () =>
      auth.api.signInEmail({
        body: { email, password: PASSWORD },
        returnHeaders: true,
      }),
  );
  const cookieHeader = setHeaders
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie: cookieHeader });
}

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantId = `tenant-deactivate-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-deactivate-${randomUUID()}`, "Deactivate Lab"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe("deactivateUser (Task 6, AC 2/3/4/5)", () => {
  it("sets isActive=false, deletes the user's sessions, and writes a USER_DEACTIVATED AuditLog row", async () => {
    const admin = await seedUser("admin");
    const target = await seedUser("quimico");
    const adminHeaders = await signInAndBuildHeaders(admin.email);
    // Give target an active session before deactivating.
    await signInAndBuildHeaders(target.email);

    const { deactivateUser } = await import(
      "../../src/modules/auth/server/deactivate-user.action"
    );

    await deactivateUser(
      { userId: target.userId },
      { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );

    const { rows: userRows } = await owner.query(
      'SELECT "isActive" FROM "user" WHERE id = $1',
      [target.userId],
    );
    expect(userRows[0].isActive).toBe(false);

    const { rows: sessionRows } = await owner.query(
      'SELECT id FROM "session" WHERE "userId" = $1',
      [target.userId],
    );
    expect(sessionRows).toHaveLength(0);

    const { rows: auditRows } = await owner.query(
      'SELECT action, before, after, "actorUserId" FROM "audit_log" WHERE "entityId" = $1',
      [target.userId],
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: "USER_DEACTIVATED",
      before: { isActive: true },
      after: { isActive: false },
      actorUserId: admin.userId,
    });
  });

  it("AC 2: the deactivated user's existing session is rejected on its next request (active revocation)", async () => {
    const admin = await seedUser("admin");
    const target = await seedUser("quimico");
    const adminHeaders = await signInAndBuildHeaders(admin.email);
    const targetHeaders = await signInAndBuildHeaders(target.email);

    const { getCurrentActor } = await import(
      "../../src/modules/auth/server/get-current-actor"
    );
    const before = await getCurrentActor(
      { headers: targetHeaders, tenantId, requestId: `req-${randomUUID()}` },
      async (actor) => actor,
    );
    expect(before.userId).toBe(target.userId);

    const { deactivateUser } = await import(
      "../../src/modules/auth/server/deactivate-user.action"
    );
    await deactivateUser(
      { userId: target.userId },
      { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );

    await expect(
      getCurrentActor(
        { headers: targetHeaders, tenantId, requestId: `req-${randomUUID()}` },
        async (actor) => actor,
      ),
    ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS", status: 401 });
  });

  it("AC 5: an admin can never deactivate their own account, rejected BEFORE touching the database", async () => {
    const admin = await seedUser("admin");
    const adminHeaders = await signInAndBuildHeaders(admin.email);

    const { deactivateUser } = await import(
      "../../src/modules/auth/server/deactivate-user.action"
    );

    await expect(
      deactivateUser(
        { userId: admin.userId },
        { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({ status: 403 });

    const { rows } = await owner.query(
      'SELECT "isActive" FROM "user" WHERE id = $1',
      [admin.userId],
    );
    expect(rows[0].isActive).toBe(true);
  });

  it("rejects a non-admin caller (AC 4)", async () => {
    const recepcionista = await seedUser("recepcionista");
    const target = await seedUser("quimico");
    const requestHeaders = await signInAndBuildHeaders(recepcionista.email);

    const { deactivateUser } = await import(
      "../../src/modules/auth/server/deactivate-user.action"
    );

    await expect(
      deactivateUser(
        { userId: target.userId },
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("no-op guard: skips the mutation and audit write when the target is already inactive", async () => {
    const admin = await seedUser("admin");
    const target = await seedUser("quimico");
    const adminHeaders = await signInAndBuildHeaders(admin.email);

    const { deactivateUser } = await import(
      "../../src/modules/auth/server/deactivate-user.action"
    );

    // First call actually deactivates.
    await deactivateUser(
      { userId: target.userId },
      { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );

    // Second call is a no-op: target is already inactive.
    const result = await deactivateUser(
      { userId: target.userId },
      { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );
    expect(result.userId).toBe(target.userId);

    const { rows: auditRows } = await owner.query(
      'SELECT action FROM "audit_log" WHERE "entityId" = $1',
      [target.userId],
    );
    expect(auditRows).toHaveLength(1); // only the FIRST call's USER_DEACTIVATED row
  });
});
