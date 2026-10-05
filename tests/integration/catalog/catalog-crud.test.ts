/**
 * Story 2.1 (Change 2/6, Phase 2) — catalog CRUD server layer integration
 * contract. Runs on a real ephemeral Neon branch with no mocks (tenant-
 * isolation spec: "A mocked Prisma client is rejected as RLS evidence").
 *
 * Pattern (mirrors `tests/integration/auth-create-user.test.ts` and
 * `auth-rbac-denial.test.ts`): seed tenants + users via the owner client,
 * sign in through `auth.api.signInEmail` to obtain real session cookies, then
 * call each PLAIN action directly (bypassing any UI/Server-Action wrapper —
 * the same "direct API call" posture the auth RBAC tests use).
 *
 * Contract covered:
 *  - create persists + `{ENTITY}_CREATED` audit atomically;
 *  - duplicate name within a tenant -> 409 + no row; same name across tenants OK;
 *  - Equipment create with a null `calibrationDate`;
 *  - update + `{ENTITY}_UPDATED` with before/after snapshots; update -> dup 409;
 *  - deactivate/reactivate flip `isActive` and audit, with no hard delete;
 *  - deactivate-inactive and reactivate-active are no-ops (no audit row);
 *  - a non-admin -> 403 + `CATALOG_ADMIN_ACTION_DENIED`;
 *  - tenant-scoped reads never return another tenant's rows (AD-2/AD-3/RLS).
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runWithContext } from "../../../src/shared/context/request-context";

const PASSWORD = "Correct-Horse-Battery-Staple-1!";

type SeedRole = "admin" | "recepcionista" | "quimico";

interface TestSession {
  headers: Headers;
  tenantId: string;
  requestId: string;
  userId: string;
}

let owner: Client;
let tenantA: string;
let tenantB: string;

async function seedUser(
  tenantId: string,
  role: SeedRole,
): Promise<{ userId: string; email: string }> {
  const userId = `user-cat-crud-${role}-${randomUUID()}`;
  const email = `cat-crud-${role}-${randomUUID()}@example.com`;
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [userId, tenantId, email, `catcrud${randomUUID().slice(0, 8)}`, "Catalog User", role],
  );
  const hash = await hashPassword(PASSWORD);
  await owner.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-cat-crud-${randomUUID()}`, userId, userId, hash],
  );
  return { userId, email };
}

async function signInAndBuildHeaders(tenantId: string, email: string): Promise<Headers> {
  const { auth } = await import("../../../src/modules/auth/server/auth");
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

async function session(tenantId: string, role: SeedRole): Promise<TestSession> {
  const user = await seedUser(tenantId, role);
  const headers = await signInAndBuildHeaders(tenantId, user.email);
  return { headers, tenantId, requestId: `req-${randomUUID()}`, userId: user.userId };
}

async function auditRowsFor(entityId: string) {
  const { rows } = await owner.query<{
    entity: string;
    entityId: string;
    action: string;
    before: unknown;
    after: unknown;
    actorUserId: string;
  }>(
    'SELECT entity, "entityId", action, before, after, "actorUserId" FROM "audit_log" WHERE "entityId" = $1 ORDER BY "createdAt"',
    [entityId],
  );
  return rows;
}

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantA = `tenant-cat-crud-a-${randomUUID()}`;
  tenantB = `tenant-cat-crud-b-${randomUUID()}`;
  for (const [id, label] of [
    [tenantA, "a"],
    [tenantB, "b"],
  ] as const) {
    await owner.query(
      `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [id, `lab-cat-crud-${label}-${randomUUID()}`, `Catalog CRUD Lab ${label}`],
    );
  }
});

afterAll(async () => {
  await owner.end();
});

describe("createCatalog — persists and audits atomically", () => {
  it("create persists the Method row and writes METHOD_CREATED in one transaction", async () => {
    const admin = await session(tenantA, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const name = `QUIMICA SANGUINEA ${randomUUID()}`;

    const result = await createCatalog({ kind: "metodos", name }, admin);

    const { rows } = await owner.query<{ name: string; isActive: boolean; tenantId: string }>(
      'SELECT name, "isActive", "tenantId" FROM "method" WHERE id = $1',
      [result.id],
    );
    expect(rows).toEqual([{ name, isActive: true, tenantId: tenantA }]);

    const audits = await auditRowsFor(result.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      entity: "Method",
      action: "METHOD_CREATED",
      actorUserId: admin.userId,
    });
    expect(audits[0].before).toBeNull();
    expect(audits[0].after).toMatchObject({ name });
  });

  it("a duplicate name within the tenant is rejected with 409 and creates no second row", async () => {
    const admin = await session(tenantA, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const name = `DUP ${randomUUID()}`;

    const first = await createCatalog({ kind: "metodos", name }, admin);
    await expect(createCatalog({ kind: "metodos", name }, admin)).rejects.toMatchObject({
      code: "NAME_IN_USE",
      status: 409,
    });

    const { rows } = await owner.query<{ id: string }>(
      'SELECT id FROM "method" WHERE "tenantId" = $1 AND name = $2',
      [tenantA, name],
    );
    expect(rows).toEqual([{ id: first.id }]);
  });

  it("the same name in a different tenant is allowed (per-tenant uniqueness)", async () => {
    const adminA = await session(tenantA, "admin");
    const adminB = await session(tenantB, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const name = `CROSS TENANT ${randomUUID()}`;

    const createdA = await createCatalog({ kind: "tecnicas", name }, adminA);
    const createdB = await createCatalog({ kind: "tecnicas", name }, adminB);

    expect(createdA.id).not.toBe(createdB.id);
    const { rows } = await owner.query<{ tenantId: string }>(
      'SELECT "tenantId" FROM "technique" WHERE id = ANY($1)',
      [[createdA.id, createdB.id]],
    );
    expect(rows.map((r) => r.tenantId).sort()).toEqual([tenantA, tenantB].sort());
  });

  it("equipment create stores a null calibrationDate and audits EQUIPMENT_CREATED", async () => {
    const admin = await session(tenantA, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const name = `CENTRIFUGA ${randomUUID()}`;

    const result = await createCatalog(
      { kind: "equipos", name, model: "Z206A", serialNumber: `SN-${randomUUID()}` },
      admin,
    );

    const { rows } = await owner.query<{ calibrationDate: Date | null }>(
      'SELECT "calibrationDate" FROM "equipment" WHERE id = $1',
      [result.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].calibrationDate).toBeNull();

    const audits = await auditRowsFor(result.id);
    expect(audits[0]).toMatchObject({ entity: "Equipment", action: "EQUIPMENT_CREATED" });
    expect((audits[0].after as { calibrationDate: unknown }).calibrationDate).toBeNull();
  });
});

describe("updateCatalog — persists and audits with before/after snapshots", () => {
  it("update renames the row and writes METHOD_UPDATED with before/after snapshots", async () => {
    const admin = await session(tenantA, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { updateCatalog } = await import(
      "../../../src/modules/catalog/server/update-catalog.action"
    );
    const name = `ELISA ${randomUUID()}`;
    const newName = `ELISA 3GEN ${randomUUID()}`;

    const created = await createCatalog({ kind: "metodos", name }, admin);
    const result = await updateCatalog({ kind: "metodos", id: created.id, name: newName }, admin);
    expect(result.id).toBe(created.id);

    const { rows } = await owner.query<{ name: string }>(
      'SELECT name FROM "method" WHERE id = $1',
      [created.id],
    );
    expect(rows).toEqual([{ name: newName }]);

    const audits = await auditRowsFor(created.id);
    const updated = audits.find((a) => a.action === "METHOD_UPDATED");
    expect(updated).toBeDefined();
    expect(updated).toMatchObject({ entity: "Method", before: { name }, after: { name: newName } });
  });

  it("update to a duplicate name is rejected with 409 and leaves the row unchanged", async () => {
    const admin = await session(tenantA, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { updateCatalog } = await import(
      "../../../src/modules/catalog/server/update-catalog.action"
    );
    const first = `FIRST ${randomUUID()}`;
    const second = `SECOND ${randomUUID()}`;

    const created = await createCatalog({ kind: "metodos", name: first }, admin);
    await createCatalog({ kind: "metodos", name: second }, admin);

    await expect(
      updateCatalog({ kind: "metodos", id: created.id, name: second }, admin),
    ).rejects.toMatchObject({ code: "NAME_IN_USE", status: 409 });

    const { rows } = await owner.query<{ name: string }>(
      'SELECT name FROM "method" WHERE id = $1',
      [created.id],
    );
    expect(rows).toEqual([{ name: first }]);
  });

  it("updating a missing row is rejected with 404", async () => {
    const admin = await session(tenantA, "admin");
    const { updateCatalog } = await import(
      "../../../src/modules/catalog/server/update-catalog.action"
    );

    await expect(
      updateCatalog({ kind: "metodos", id: `missing-${randomUUID()}`, name: "Nope" }, admin),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("deactivate / reactivate — lifecycle without hard delete", () => {
  it("deactivate sets isActive false, keeps the row, and writes METHOD_DEACTIVATED", async () => {
    const admin = await session(tenantA, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { deactivateCatalog } = await import(
      "../../../src/modules/catalog/server/deactivate-catalog.action"
    );

    const created = await createCatalog({ kind: "metodos", name: `DEACT ${randomUUID()}` }, admin);
    await deactivateCatalog({ kind: "metodos", id: created.id }, admin);

    const { rows } = await owner.query<{ isActive: boolean }>(
      'SELECT "isActive" FROM "method" WHERE id = $1',
      [created.id],
    );
    expect(rows).toEqual([{ isActive: false }]);

    const audits = await auditRowsFor(created.id);
    const deactivated = audits.find((a) => a.action === "METHOD_DEACTIVATED");
    expect(deactivated).toMatchObject({ before: { isActive: true }, after: { isActive: false } });
  });

  it("reactivate sets isActive true and writes METHOD_REACTIVATED", async () => {
    const admin = await session(tenantA, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { deactivateCatalog } = await import(
      "../../../src/modules/catalog/server/deactivate-catalog.action"
    );
    const { reactivateCatalog } = await import(
      "../../../src/modules/catalog/server/reactivate-catalog.action"
    );

    const created = await createCatalog({ kind: "metodos", name: `REACT ${randomUUID()}` }, admin);
    await deactivateCatalog({ kind: "metodos", id: created.id }, admin);
    await reactivateCatalog({ kind: "metodos", id: created.id }, admin);

    const { rows } = await owner.query<{ isActive: boolean }>(
      'SELECT "isActive" FROM "method" WHERE id = $1',
      [created.id],
    );
    expect(rows).toEqual([{ isActive: true }]);

    const audits = await auditRowsFor(created.id);
    const reactivated = audits.find((a) => a.action === "METHOD_REACTIVATED");
    expect(reactivated).toMatchObject({ before: { isActive: false }, after: { isActive: true } });
  });

  it("deactivating an already-inactive row is a no-op (no second audit row)", async () => {
    const admin = await session(tenantA, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { deactivateCatalog } = await import(
      "../../../src/modules/catalog/server/deactivate-catalog.action"
    );

    const created = await createCatalog({ kind: "recipientes", name: `NOOP-D ${randomUUID()}` }, admin);
    await deactivateCatalog({ kind: "recipientes", id: created.id }, admin);
    await deactivateCatalog({ kind: "recipientes", id: created.id }, admin);

    const audits = await auditRowsFor(created.id);
    expect(audits.filter((a) => a.action === "CONTAINER_DEACTIVATED")).toHaveLength(1);
  });

  it("reactivating an already-active row is a no-op (no audit row)", async () => {
    const admin = await session(tenantA, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { reactivateCatalog } = await import(
      "../../../src/modules/catalog/server/reactivate-catalog.action"
    );

    const created = await createCatalog({ kind: "recipientes", name: `NOOP-R ${randomUUID()}` }, admin);
    await reactivateCatalog({ kind: "recipientes", id: created.id }, admin);

    const audits = await auditRowsFor(created.id);
    expect(audits.filter((a) => a.action === "CONTAINER_REACTIVATED")).toHaveLength(0);
  });
});

describe("RBAC — catalog mutations are admin-only", () => {
  it("a non-admin is rejected with 403 and the attempt is logged as CATALOG_ADMIN_ACTION_DENIED", async () => {
    const quimico = await session(tenantA, "quimico");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );

    await expect(
      createCatalog({ kind: "metodos", name: `DENIED ${randomUUID()}` }, quimico),
    ).rejects.toMatchObject({ status: 403 });

    const { rows } = await owner.query<{ action: string; entity: string; entityId: string }>(
      'SELECT action, entity, "entityId" FROM "audit_log" WHERE "actorUserId" = $1 AND action = $2',
      [quimico.userId, "CATALOG_ADMIN_ACTION_DENIED"],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entity: "Method" });
  });
});

describe("tenant isolation — reads never cross tenant boundaries (AD-2/AD-3)", () => {
  it("listCatalogRows returns only the caller tenant's rows", async () => {
    const adminA = await session(tenantA, "admin");
    const adminB = await session(tenantB, "admin");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { listCatalogRows } = await import(
      "../../../src/modules/catalog/server/catalog-queries"
    );

    const createdA = await createCatalog(
      { kind: "recipientes", name: `ISO A ${randomUUID()}` },
      adminA,
    );
    const createdB = await createCatalog(
      { kind: "recipientes", name: `ISO B ${randomUUID()}` },
      adminB,
    );

    const rowsA = await listCatalogRows("recipientes", { tenantId: tenantA, role: "admin" });
    const idsA = rowsA.map((r) => r.id);
    expect(idsA).toContain(createdA.id);
    expect(idsA).not.toContain(createdB.id);
  });
});
