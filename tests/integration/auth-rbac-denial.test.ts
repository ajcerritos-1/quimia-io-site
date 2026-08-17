/**
 * Story 1.2 Task 8 — RBAC-denial coverage (AC 4). A `recepcionista`/
 * `quimico`-role session calls the create/edit-role/deactivate Server
 * Actions DIRECTLY (bypassing the UI entirely, simulating a "direct API
 * call") for every one of the three actions this story adds — each must be
 * rejected with a 403 `AppError` AND the attempt itself must be logged to
 * `AuditLog`. Individual coverage already exists per-action
 * (`auth-create-user.test.ts`, `auth-update-user-role.test.ts`,
 * `auth-deactivate-user.test.ts`); this file is the dedicated,
 * cross-cutting proof Task 8 calls for, covering both non-admin roles
 * across all three actions in one place.
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
  const userId = `user-rbac-${randomUUID()}`;
  const email = `rbac-${randomUUID()}@example.com`;
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [userId, tenantId, email, `rbac${randomUUID().slice(0, 8)}`, "RBAC User", role],
  );
  const hash = await hashPassword(PASSWORD);
  await owner.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-rbac-${randomUUID()}`, userId, userId, hash],
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

async function deniedAuditRowFor(actorUserId: string) {
  const { rows } = await owner.query(
    'SELECT action, "actorUserId", "tenantId", "entityId", after FROM "audit_log" WHERE "actorUserId" = $1 AND action = $2',
    [actorUserId, "USER_ADMIN_ACTION_DENIED"],
  );
  return rows;
}

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantId = `tenant-rbac-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-rbac-${randomUUID()}`, "RBAC Lab"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe("RBAC-denial coverage (Task 8, AC 4) — direct Server Action calls, bypassing the UI", () => {
  it("createUser: a recepcionista session is rejected (403) and the attempt is logged", async () => {
    const recepcionista = await seedUser("recepcionista");
    const requestHeaders = await signInAndBuildHeaders(recepcionista.email);

    const { createUser } = await import(
      "../../src/modules/auth/server/create-user.action"
    );

    await expect(
      createUser(
        {
          email: `denied-${randomUUID()}@example.com`,
          nickname: `denied${randomUUID().slice(0, 8)}`,
          name: "Denied",
          password: "Some-Strong-Password-1!",
          role: "quimico",
        },
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({ status: 403 });

    const rows = await deniedAuditRowFor(recepcionista.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ after: { attemptedAction: "USER_CREATE" } });
  });

  it("updateUserRole: a quimico session is rejected (403) and the attempt is logged", async () => {
    const quimico = await seedUser("quimico");
    const target = await seedUser("recepcionista");
    const requestHeaders = await signInAndBuildHeaders(quimico.email);

    const { updateUserRole } = await import(
      "../../src/modules/auth/server/update-user-role.action"
    );

    await expect(
      updateUserRole(
        { userId: target.userId, role: "admin" },
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({ status: 403 });

    const rows = await deniedAuditRowFor(quimico.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityId: target.userId,
      after: { attemptedAction: "USER_ROLE_CHANGE" },
    });
  });

  it("deactivateUser: a recepcionista session is rejected (403) and the attempt is logged", async () => {
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

    const rows = await deniedAuditRowFor(recepcionista.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityId: target.userId,
      after: { attemptedAction: "USER_DEACTIVATE" },
    });

    // The target was NOT deactivated — the denial happened before any mutation.
    const { rows: userRows } = await owner.query(
      'SELECT "isActive" FROM "user" WHERE id = $1',
      [target.userId],
    );
    expect(userRows[0].isActive).toBe(true);
  });

  it("deactivateUser: a quimico session is rejected (403) and the attempt is logged", async () => {
    const quimico = await seedUser("quimico");
    const target = await seedUser("recepcionista");
    const requestHeaders = await signInAndBuildHeaders(quimico.email);

    const { deactivateUser } = await import(
      "../../src/modules/auth/server/deactivate-user.action"
    );

    await expect(
      deactivateUser(
        { userId: target.userId },
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect(await deniedAuditRowFor(quimico.userId)).toHaveLength(1);
  });

  it("reactivateUser: a recepcionista session is rejected (403) and the attempt is logged", async () => {
    const recepcionista = await seedUser("recepcionista");
    const target = await seedUser("quimico");
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

    const rows = await deniedAuditRowFor(recepcionista.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityId: target.userId,
      after: { attemptedAction: "USER_REACTIVATE" },
    });
  });

  it("reactivateUser: a quimico session is rejected (403) and the attempt is logged", async () => {
    const quimico = await seedUser("quimico");
    const target = await seedUser("recepcionista");
    const requestHeaders = await signInAndBuildHeaders(quimico.email);

    const { reactivateUser } = await import(
      "../../src/modules/auth/server/reactivate-user.action"
    );

    await expect(
      reactivateUser(
        { userId: target.userId },
        { headers: requestHeaders, tenantId, requestId: `req-${randomUUID()}` },
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect(await deniedAuditRowFor(quimico.userId)).toHaveLength(1);
  });
});
