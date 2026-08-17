/**
 * Story 1.2 Task 5 — `updateUserRole()`. One `transaction()` call updates
 * `User.role` and writes the `AuditLog` row (`USER_ROLE_CHANGED`,
 * before/after carrying the old/new role). AC 3's "permissions change on
 * their next request" is already satisfied by Story 1.1's
 * `cookieCache: { enabled: false }` (the user row, including `role`, is
 * re-read fresh every request) — this test confirms that holds against an
 * EXISTING session (no fresh sign-in), rather than building a second
 * mechanism to achieve the same thing.
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
  const userId = `user-editrole-${randomUUID()}`;
  const email = `editrole-${randomUUID()}@example.com`;
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [userId, tenantId, email, `editrole${randomUUID().slice(0, 8)}`, "Edit Role User", role],
  );
  const hash = await hashPassword(PASSWORD);
  await owner.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-editrole-${randomUUID()}`, userId, userId, hash],
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
  tenantId = `tenant-editrole-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-editrole-${randomUUID()}`, "Edit Role Lab"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe("updateUserRole (Task 5, AC 3/4)", () => {
  it("updates User.role and writes a USER_ROLE_CHANGED AuditLog row with before/after", async () => {
    const admin = await seedUser("admin");
    const target = await seedUser("quimico");
    const adminHeaders = await signInAndBuildHeaders(admin.email);

    const { updateUserRole } = await import(
      "../../src/modules/auth/server/update-user-role.action"
    );

    await updateUserRole(
      { userId: target.userId, role: "recepcionista" },
      { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );

    const { rows: userRows } = await owner.query(
      'SELECT role FROM "user" WHERE id = $1',
      [target.userId],
    );
    expect(userRows[0].role).toBe("recepcionista");

    const { rows: auditRows } = await owner.query(
      'SELECT action, before, after, "actorUserId" FROM "audit_log" WHERE "entityId" = $1',
      [target.userId],
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: "USER_ROLE_CHANGED",
      before: { role: "quimico" },
      after: { role: "recepcionista" },
      actorUserId: admin.userId,
    });
  });

  it("AC 3: an EXISTING session for the edited user reflects the new role on its next request (no re-sign-in)", async () => {
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
    expect(before.role).toBe("quimico");

    const { updateUserRole } = await import(
      "../../src/modules/auth/server/update-user-role.action"
    );
    await updateUserRole(
      { userId: target.userId, role: "recepcionista" },
      { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );

    const after = await getCurrentActor(
      { headers: targetHeaders, tenantId, requestId: `req-${randomUUID()}` },
      async (actor) => actor,
    );
    expect(after.role).toBe("recepcionista");
  });

  it("rejects a non-admin caller (AC 4)", async () => {
    const recepcionista = await seedUser("recepcionista");
    const target = await seedUser("quimico");
    const requestHeaders = await signInAndBuildHeaders(recepcionista.email);

    const { updateUserRole } = await import(
      "../../src/modules/auth/server/update-user-role.action"
    );

    await expect(
      updateUserRole(
        { userId: target.userId, role: "admin" },
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("AC 6: an admin can never change their own role, rejected BEFORE touching the database", async () => {
    const admin = await seedUser("admin");
    const adminHeaders = await signInAndBuildHeaders(admin.email);

    const { updateUserRole } = await import(
      "../../src/modules/auth/server/update-user-role.action"
    );

    await expect(
      updateUserRole(
        { userId: admin.userId, role: "quimico" },
        { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "SELF_ROLE_CHANGE_FORBIDDEN",
    });

    const { rows } = await owner.query(
      'SELECT role FROM "user" WHERE id = $1',
      [admin.userId],
    );
    expect(rows[0].role).toBe("admin");
  });

  it("no-op guard: skips the mutation and audit write when the requested role is already current", async () => {
    const admin = await seedUser("admin");
    const target = await seedUser("quimico");
    const adminHeaders = await signInAndBuildHeaders(admin.email);

    const { updateUserRole } = await import(
      "../../src/modules/auth/server/update-user-role.action"
    );

    const result = await updateUserRole(
      { userId: target.userId, role: "quimico" },
      { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );
    expect(result.userId).toBe(target.userId);

    const { rows: auditRows } = await owner.query(
      'SELECT action FROM "audit_log" WHERE "entityId" = $1',
      [target.userId],
    );
    expect(auditRows).toHaveLength(0);
  });
});
