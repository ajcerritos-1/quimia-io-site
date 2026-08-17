/**
 * Story 1.2 Task 9 — `reactivateUser()` (AC 7, code-review follow-up
 * 2026-08-16). Mirrors `deactivateUser()`'s structure, inverted: one
 * `transaction()` call sets `User.isActive = true` and writes the
 * `AuditLog` row (`USER_REACTIVATED`). No self-check needed —
 * `getCurrentActor()`'s `isActive` re-check already makes it impossible for
 * a deactivated actor to call any admin action, so self-reactivation can
 * never arise.
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
  isActive = true,
): Promise<{ userId: string; email: string }> {
  const userId = `user-reactivate-${randomUUID()}`;
  const email = `reactivate-${randomUUID()}@example.com`;
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [
      userId,
      tenantId,
      email,
      `reactivate${randomUUID().slice(0, 8)}`,
      "Reactivate User",
      role,
      isActive,
    ],
  );
  const hash = await hashPassword(PASSWORD);
  await owner.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-reactivate-${randomUUID()}`, userId, userId, hash],
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
  tenantId = `tenant-reactivate-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-reactivate-${randomUUID()}`, "Reactivate Lab"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe("reactivateUser (Task 9, AC 7)", () => {
  it("sets isActive=true and writes a USER_REACTIVATED AuditLog row", async () => {
    const admin = await seedUser("admin");
    const target = await seedUser("quimico", false);
    const adminHeaders = await signInAndBuildHeaders(admin.email);

    const { reactivateUser } = await import(
      "../../src/modules/auth/server/reactivate-user.action"
    );

    await reactivateUser(
      { userId: target.userId },
      { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );

    const { rows: userRows } = await owner.query(
      'SELECT "isActive" FROM "user" WHERE id = $1',
      [target.userId],
    );
    expect(userRows[0].isActive).toBe(true);

    const { rows: auditRows } = await owner.query(
      'SELECT action, before, after, "actorUserId" FROM "audit_log" WHERE "entityId" = $1',
      [target.userId],
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: "USER_REACTIVATED",
      before: { isActive: false },
      after: { isActive: true },
      actorUserId: admin.userId,
    });
  });

  it("AC 7: a reactivated user can sign in again", async () => {
    const admin = await seedUser("admin");
    const target = await seedUser("quimico", false);
    const adminHeaders = await signInAndBuildHeaders(admin.email);

    const { reactivateUser } = await import(
      "../../src/modules/auth/server/reactivate-user.action"
    );
    await reactivateUser(
      { userId: target.userId },
      { headers: adminHeaders, tenantId, requestId: `req-${randomUUID()}` },
    );

    const { signIn } = await import("../../src/modules/auth/server/sign-in.action");
    const signInResult = await signIn(
      { identifier: target.email, password: PASSWORD },
      { tenantId, isActive: true },
      `req-signin-check-${randomUUID()}`,
    );
    expect(signInResult.ok).toBe(true);
  });

  it("rejects a non-admin caller (AC 4)", async () => {
    const recepcionista = await seedUser("recepcionista");
    const target = await seedUser("quimico", false);
    const requestHeaders = await signInAndBuildHeaders(recepcionista.email);

    const { reactivateUser } = await import(
      "../../src/modules/auth/server/reactivate-user.action"
    );

    await expect(
      reactivateUser(
        { userId: target.userId },
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("no-op guard: skips the mutation and audit write when the target is already active", async () => {
    const admin = await seedUser("admin");
    const target = await seedUser("quimico", true);
    const adminHeaders = await signInAndBuildHeaders(admin.email);

    const { reactivateUser } = await import(
      "../../src/modules/auth/server/reactivate-user.action"
    );

    const result = await reactivateUser(
      { userId: target.userId },
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
