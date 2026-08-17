/**
 * Story 1.2 Task 4 — `createUser()`. One `transaction()` call creates the
 * `User` row, the matching `Account` row (Better Auth's own email/password
 * shape: `providerId: "credential"`, `accountId` = the new user's id), and
 * the `AuditLog` row (`USER_CREATED`) — three inserts, one wrapper
 * transaction (AD-4). Verifies AC 1's "and can sign in" by actually signing
 * in with the initial password through the existing `signIn()` flow,
 * unmodified. Real ephemeral Neon branch, real signed session cookies.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runWithContext } from "../../src/shared/context/request-context";

const ADMIN_PASSWORD = "Correct-Horse-Battery-Staple-1!";
const NEW_USER_PASSWORD = "Another-Strong-Password-2!";

let owner: Client;
let tenantId: string;

async function seedAdmin(): Promise<{ userId: string; email: string }> {
  const userId = `user-createuser-admin-${randomUUID()}`;
  const email = `createuser-admin-${randomUUID()}@example.com`;
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'admin', now())`,
    [userId, tenantId, email, `createadmin${randomUUID().slice(0, 8)}`, "Create Admin"],
  );
  const hash = await hashPassword(ADMIN_PASSWORD);
  await owner.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-createuser-admin-${randomUUID()}`, userId, userId, hash],
  );
  return { userId, email };
}

async function signInAndBuildHeaders(email: string): Promise<Headers> {
  const { auth } = await import("../../src/modules/auth/server/auth");
  const { headers: setHeaders } = await runWithContext(
    { requestId: `req-signin-${randomUUID()}`, tenant: { tenantId, role: "anonymous" } },
    () =>
      auth.api.signInEmail({
        body: { email, password: ADMIN_PASSWORD },
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
  tenantId = `tenant-createuser-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-createuser-${randomUUID()}`, "Create User Lab"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe("createUser (Task 4, AC 1/3/4)", () => {
  it("creates a User + Account + AuditLog row in one transaction, and the new user can sign in (AC 1)", async () => {
    const admin = await seedAdmin();
    const requestHeaders = await signInAndBuildHeaders(admin.email);
    const newEmail = `new-user-${randomUUID()}@example.com`;
    const newNickname = `newuser${randomUUID().slice(0, 8)}`;

    const { createUser } = await import(
      "../../src/modules/auth/server/create-user.action"
    );

    const result = await createUser(
      {
        email: newEmail,
        nickname: newNickname,
        name: "Brand New User",
        password: NEW_USER_PASSWORD,
        role: "quimico",
      },
      { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );

    expect(result.userId).toBeTruthy();

    const { rows: userRows } = await owner.query(
      'SELECT email, nickname, name, role, "isActive" FROM "user" WHERE id = $1',
      [result.userId],
    );
    expect(userRows).toEqual([
      { email: newEmail, nickname: newNickname, name: "Brand New User", role: "quimico", isActive: true },
    ]);

    const { rows: accountRows } = await owner.query(
      'SELECT "providerId", "accountId", "userId" FROM "account" WHERE "userId" = $1',
      [result.userId],
    );
    expect(accountRows).toEqual([
      { providerId: "credential", accountId: result.userId, userId: result.userId },
    ]);

    const { rows: auditRows } = await owner.query(
      'SELECT entity, "entityId", action, before, "actorUserId" FROM "audit_log" WHERE "entityId" = $1',
      [result.userId],
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      entity: "User",
      entityId: result.userId,
      action: "USER_CREATED",
      before: null,
      actorUserId: admin.userId,
    });

    // AC 1: the created user can sign in with the initial password,
    // through the existing signIn() flow, unmodified.
    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const signInResult = await signIn(
      { identifier: newEmail, password: NEW_USER_PASSWORD },
      { tenantId, isActive: true },
      `req-signin-check-${randomUUID()}`,
    );
    expect(signInResult.ok).toBe(true);
  });

  it("rejects a password shorter than the shared minPasswordLength policy (AD-8, no divergent check)", async () => {
    const admin = await seedAdmin();
    const requestHeaders = await signInAndBuildHeaders(admin.email);

    const { createUser } = await import(
      "../../src/modules/auth/server/create-user.action"
    );

    await expect(
      createUser(
        {
          email: `short-pw-${randomUUID()}@example.com`,
          nickname: `shortpw${randomUUID().slice(0, 8)}`,
          name: "Short Password",
          password: "short1!",
          role: "quimico",
        },
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("rejects a duplicate email with a friendly 409 instead of a raw Prisma crash (code-review follow-up)", async () => {
    const admin = await seedAdmin();
    const requestHeaders = await signInAndBuildHeaders(admin.email);

    const { createUser } = await import(
      "../../src/modules/auth/server/create-user.action"
    );

    const existingEmail = `dup-${randomUUID()}@example.com`;
    await createUser(
      {
        email: existingEmail,
        nickname: `dup${randomUUID().slice(0, 8)}`,
        name: "Original User",
        password: NEW_USER_PASSWORD,
        role: "quimico",
      },
      { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );

    await expect(
      createUser(
        {
          email: existingEmail,
          nickname: `dup${randomUUID().slice(0, 8)}`,
          name: "Duplicate User",
          password: NEW_USER_PASSWORD,
          role: "quimico",
        },
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({
      code: "EMAIL_OR_NICKNAME_IN_USE",
      status: 409,
    });
  });

  it("rejects a non-admin caller (AC 4) and the attempt itself is logged", async () => {
    const recepUserId = `user-createuser-recep-${randomUUID()}`;
    const recepEmail = `createuser-recep-${randomUUID()}@example.com`;
    await owner.query(
      `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'recepcionista', now())`,
      [recepUserId, tenantId, recepEmail, `createuserrecep${randomUUID().slice(0, 8)}`, "Recep User"],
    );
    const hash = await hashPassword(ADMIN_PASSWORD);
    await owner.query(
      `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
       VALUES ($1, $2, 'credential', $3, $4, now())`,
      [`account-createuser-recep-${randomUUID()}`, recepUserId, recepUserId, hash],
    );

    const { auth } = await import("../../src/modules/auth/server/auth");
    const { headers: setHeaders } = await runWithContext(
      { requestId: `req-signin-${randomUUID()}`, tenant: { tenantId, role: "anonymous" } },
      () =>
        auth.api.signInEmail({
          body: { email: recepEmail, password: ADMIN_PASSWORD },
          returnHeaders: true,
        }),
    );
    const cookieHeader = setHeaders
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const requestHeaders = new Headers({ cookie: cookieHeader });

    const { createUser } = await import(
      "../../src/modules/auth/server/create-user.action"
    );

    await expect(
      createUser(
        {
          email: `blocked-${randomUUID()}@example.com`,
          nickname: `blocked${randomUUID().slice(0, 8)}`,
          name: "Blocked User",
          password: NEW_USER_PASSWORD,
          role: "quimico",
        },
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({ status: 403 });

    const { rows } = await owner.query(
      'SELECT action FROM "audit_log" WHERE "actorUserId" = $1',
      [recepUserId],
    );
    expect(rows).toEqual([{ action: "USER_ADMIN_ACTION_DENIED" }]);
  });
});
