/**
 * Story 2.1 (Change 2/6), Phase 2 — catalog plain server actions + typed
 * queries against a REAL ephemeral Neon branch (no mocked Prisma client;
 * RLS/audit evidence requires a real Postgres branch, `fileParallelism:
 * false`). Covers the full Phase 2 contract from tasks.md 2.1:
 *
 * - create persists the row AND writes `{ENTITY}_CREATED` audit atomically
 *   (same transaction, AD-4/AD-10)
 * - duplicate name within tenant → 409 `NAME_IN_USE`, no second row
 * - same name across tenants is allowed (uniqueness is per tenant)
 * - equipment create with `calibrationDate: null` and with a date string
 * - update + `{ENTITY}_UPDATED` with `before`/`after` snapshots
 * - update → duplicate → 409, row unchanged
 * - deactivate flips `isActive` to false + `_DEACTIVATED`, no hard delete
 * - reactivate flips `isActive` to true + `_REACTIVATED`
 * - deactivate-inactive / reactivate-active are no-ops (no audit row)
 * - non-admin (`quimico`/`recepcionista`) → 403 + `CATALOG_ADMIN_ACTION_DENIED`
 * - typed queries (`listCatalogRows`/`countActive`/`getCatalogStats`) stay
 *   tenant-scoped, order by name, and count active rows only
 *
 * Seeding/session pattern: `tests/integration/auth-create-user.test.ts` /
 * `auth-rbac-denial.test.ts` — seed tenant + user via owner client, sign in
 * through `auth.api.signInEmail`, then call the plain action directly.
 *
 * Connection budget (why this file is shaped the way it is): the ephemeral
 * branch is a free-tier Neon branch with a small connection budget, and each
 * real `signInEmail` opens transactions on its own pool. Signing in once per
 * test (17×) saturated the branch and stalled `$transaction` calls ("Unable
 * to start a transaction in the given time", then multi-minute hangs). So we
 * sign in exactly once per role in `beforeAll` and give each test its own
 * UNIQUE name instead of its own tenant. Uniqueness is per `(tenantId, name)`,
 * so unique names preserve per-test isolation on a shared tenant.
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runWithContext } from "../../../src/shared/context/request-context";

const PASSWORD = "Correct-Horse-Battery-Staple-1!";

let owner: Client;
let tenantA: string;
let tenantB: string;
let adminHeaders: Headers;
let adminUserId: string;
let quimicoHeaders: Headers;
let quimicoUserId: string;
let recepcionistaHeaders: Headers;
let recepcionistaUserId: string;

async function insertTenant(id: string): Promise<void> {
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [id, `lab-catcrud-${randomUUID()}`, "Catalog CRUD Lab"],
  );
}

async function seedUser(
  tenantId: string,
  role: "admin" | "quimico" | "recepcionista",
  passwordHash: string,
): Promise<{ userId: string; email: string }> {
  const userId = `user-catcrud-${randomUUID()}`;
  const email = `catcrud-${randomUUID()}@example.com`;
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [userId, tenantId, email, `catcrud${randomUUID().slice(0, 8)}`, "Catalog CRUD User", role],
  );
  await owner.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-catcrud-${randomUUID()}`, userId, userId, passwordHash],
  );
  return { userId, email };
}

async function signIn(email: string, tenantId: string): Promise<Headers> {
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

/** Fresh unique name per test — uniqueness is `(tenantId, name)`, so a unique
 *  name keeps each test isolated on the shared tenant. */
function uniqueName(base: string): string {
  return `${base} ${randomUUID().slice(0, 8).toUpperCase()}`;
}

function req(headers: Headers, tenantId: string) {
  return { headers, tenantId, requestId: `req-${randomUUID()}` };
}

/** Seed a Method row directly via the owner (bypasses the app role path). */
async function seedMethodRow(tenantId: string, name: string): Promise<string> {
  const id = `method-seed-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [id, tenantId, name],
  );
  return id;
}

async function newTenant(): Promise<string> {
  const id = `tenant-catcrud-${randomUUID()}`;
  await insertTenant(id);
  return id;
}

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();

  tenantA = await newTenant();
  tenantB = await newTenant();

  // One scrypt hash reused by all three seeded users (same password) — saves
  // two CPU-heavy derivations up front.
  const passwordHash = await hashPassword(PASSWORD);

  const admin = await seedUser(tenantA, "admin", passwordHash);
  adminUserId = admin.userId;
  adminHeaders = await signIn(admin.email, tenantA);

  const quimico = await seedUser(tenantA, "quimico", passwordHash);
  quimicoUserId = quimico.userId;
  quimicoHeaders = await signIn(quimico.email, tenantA);

  const recepcionista = await seedUser(tenantA, "recepcionista", passwordHash);
  recepcionistaUserId = recepcionista.userId;
  recepcionistaHeaders = await signIn(recepcionista.email, tenantA);
});

afterAll(async () => {
  await owner.end();
});

describe("catalog plain actions + typed queries (Phase 2 — audit + tenant-scope contract)", () => {
  it("createCatalog persists the Method row and writes METHOD_CREATED audit atomically", async () => {
    const name = uniqueName("QUIMICA SANGUINEA");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );

    const result = await createCatalog({ kind: "metodos", name }, req(adminHeaders, tenantA));
    expect(result.id).toBeTruthy();

    const { rows: methodRows } = await owner.query(
      'SELECT name, "isActive", "tenantId" FROM "method" WHERE id = $1',
      [result.id],
    );
    expect(methodRows).toEqual([{ name, isActive: true, tenantId: tenantA }]);

    const { rows: auditRows } = await owner.query(
      'SELECT entity, "entityId", action, before, after, "actorUserId" FROM "audit_log" WHERE "entityId" = $1',
      [result.id],
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      entity: "Method",
      entityId: result.id,
      action: "METHOD_CREATED",
      before: null,
      after: { name },
      actorUserId: adminUserId,
    });
  });

  it("createCatalog handles every kind through the typed switch and audits each entity", async () => {
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );

    const cases = [
      { kind: "tecnicas", name: uniqueName("ESPECTROFOTOMETRIA"), entity: "Technique", action: "TECHNIQUE_CREATED" },
      { kind: "recipientes", name: uniqueName("TUBO LILA EDTA"), entity: "Container", action: "CONTAINER_CREATED" },
      { kind: "tipos-de-muestra", name: uniqueName("ORINA"), entity: "SampleType", action: "SAMPLE_TYPE_CREATED" },
    ] as const;

    for (const c of cases) {
      const res = await createCatalog({ kind: c.kind, name: c.name }, req(adminHeaders, tenantA));
      const { rows } = await owner.query(
        'SELECT entity, action FROM "audit_log" WHERE "entityId" = $1',
        [res.id],
      );
      expect(rows).toEqual([{ entity: c.entity, action: c.action }]);
    }
  });

  it("createCatalog stores equipment with a null calibrationDate and audits EQUIPMENT_CREATED", async () => {
    const name = uniqueName("BALANZA ANALITICA");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );

    const result = await createCatalog(
      {
        kind: "equipos",
        name,
        model: "M-200",
        serialNumber: "SN-001",
        calibrationDate: null,
      },
      req(adminHeaders, tenantA),
    );

    const { rows: eqRows } = await owner.query(
      'SELECT name, model, "serialNumber", "calibrationDate" FROM "equipment" WHERE id = $1',
      [result.id],
    );
    expect(eqRows).toEqual([
      { name, model: "M-200", serialNumber: "SN-001", calibrationDate: null },
    ]);

    const { rows: auditRows } = await owner.query(
      'SELECT entity, action, before, after FROM "audit_log" WHERE "entityId" = $1',
      [result.id],
    );
    expect(auditRows[0]).toMatchObject({
      entity: "Equipment",
      action: "EQUIPMENT_CREATED",
      before: null,
      after: { name, model: "M-200", serialNumber: "SN-001", calibrationDate: null },
    });
  });

  it("createCatalog coerces a calibrationDate string to a Date and audits its ISO form", async () => {
    const name = uniqueName("CENTRIFUGA");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );

    const result = await createCatalog(
      {
        kind: "equipos",
        name,
        model: "C-500",
        serialNumber: "SN-002",
        calibrationDate: "2026-05-20",
      },
      req(adminHeaders, tenantA),
    );

    // Read the calendar date as text: `pg` decodes `timestamp(3)` into a Date
    // in the server's local zone, so String(Date)/toISOString() would be
    // timezone-dependent. `to_char` pins it deterministically.
    const { rows: eqRows } = await owner.query(
      `SELECT to_char("calibrationDate", 'YYYY-MM-DD') AS calibration_date FROM "equipment" WHERE id = $1`,
      [result.id],
    );
    expect(eqRows[0].calibration_date).toBe("2026-05-20");

    const { rows: auditRows } = await owner.query(
      'SELECT after FROM "audit_log" WHERE "entityId" = $1',
      [result.id],
    );
    expect(auditRows[0].after).toMatchObject({
      calibrationDate: "2026-05-20T00:00:00.000Z",
    });
  });

  it("createCatalog rejects a duplicate name within the tenant with 409 and no second row", async () => {
    const name = uniqueName("QUIMICA SANGUINEA");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );

    const first = await createCatalog({ kind: "metodos", name }, req(adminHeaders, tenantA));
    expect(first.id).toBeTruthy();

    await expect(
      createCatalog({ kind: "metodos", name }, req(adminHeaders, tenantA)),
    ).rejects.toMatchObject({ code: "NAME_IN_USE", status: 409 });

    const { rows } = await owner.query(
      'SELECT COUNT(*)::int AS count FROM "method" WHERE "tenantId" = $1 AND name = $2',
      [tenantA, name],
    );
    expect(rows[0].count).toBe(1);
  });

  it("createCatalog allows the same name in a different tenant (uniqueness is per tenant)", async () => {
    const name = uniqueName("QUIMICA SANGUINEA");
    // Tenant B already has this name (seeded directly via owner).
    await seedMethodRow(tenantB, name);

    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );

    const result = await createCatalog({ kind: "metodos", name }, req(adminHeaders, tenantA));
    expect(result.id).toBeTruthy();

    const { rows } = await owner.query(
      'SELECT COUNT(*)::int AS count FROM "method" WHERE "tenantId" = $1 AND name = $2',
      [tenantA, name],
    );
    expect(rows[0].count).toBe(1);
  });

  it("updateCatalog renames a row and writes METHOD_UPDATED with before/after snapshots", async () => {
    const name = uniqueName("ELISA");
    const renamed = uniqueName("ELISA 3GEN");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { updateCatalog } = await import(
      "../../../src/modules/catalog/server/update-catalog.action"
    );

    const created = await createCatalog({ kind: "metodos", name }, req(adminHeaders, tenantA));

    await updateCatalog(
      { kind: "metodos", id: created.id, name: renamed },
      req(adminHeaders, tenantA),
    );

    const { rows: methodRows } = await owner.query(
      'SELECT name FROM "method" WHERE id = $1',
      [created.id],
    );
    expect(methodRows).toEqual([{ name: renamed }]);

    const { rows: auditRows } = await owner.query(
      'SELECT entity, action, before, after FROM "audit_log" WHERE "entityId" = $1 AND action = $2',
      [created.id, "METHOD_UPDATED"],
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      entity: "Method",
      action: "METHOD_UPDATED",
      before: { name },
      after: { name: renamed },
    });
  });

  it("updateCatalog updates equipment fields and audits the full before/after snapshot", async () => {
    const name = uniqueName("BALANZA");
    const renamed = uniqueName("BALANZA 2");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { updateCatalog } = await import(
      "../../../src/modules/catalog/server/update-catalog.action"
    );

    const created = await createCatalog(
      {
        kind: "equipos",
        name,
        model: "M-200",
        serialNumber: "SN-001",
        calibrationDate: null,
      },
      req(adminHeaders, tenantA),
    );

    await updateCatalog(
      {
        kind: "equipos",
        id: created.id,
        name: renamed,
        model: "M-210",
        serialNumber: "SN-002",
        calibrationDate: "2026-06-01",
      },
      req(adminHeaders, tenantA),
    );

    const { rows: eqRows } = await owner.query(
      'SELECT name, model, "serialNumber" FROM "equipment" WHERE id = $1',
      [created.id],
    );
    expect(eqRows).toEqual([{ name: renamed, model: "M-210", serialNumber: "SN-002" }]);

    const { rows: auditRows } = await owner.query(
      'SELECT action, before, after FROM "audit_log" WHERE "entityId" = $1 AND action = $2',
      [created.id, "EQUIPMENT_UPDATED"],
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: "EQUIPMENT_UPDATED",
      before: {
        name,
        model: "M-200",
        serialNumber: "SN-001",
        calibrationDate: null,
      },
      after: {
        name: renamed,
        model: "M-210",
        serialNumber: "SN-002",
        calibrationDate: "2026-06-01T00:00:00.000Z",
      },
    });
  });

  it("updateCatalog rejects renaming to a duplicate name with 409 and leaves the row unchanged", async () => {
    const kept = uniqueName("ELISA");
    const toRename = uniqueName("PCR");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { updateCatalog } = await import(
      "../../../src/modules/catalog/server/update-catalog.action"
    );

    await createCatalog({ kind: "metodos", name: kept }, req(adminHeaders, tenantA));
    const pcr = await createCatalog({ kind: "metodos", name: toRename }, req(adminHeaders, tenantA));

    await expect(
      updateCatalog({ kind: "metodos", id: pcr.id, name: kept }, req(adminHeaders, tenantA)),
    ).rejects.toMatchObject({ code: "NAME_IN_USE", status: 409 });

    const { rows } = await owner.query('SELECT name FROM "method" WHERE id = $1', [pcr.id]);
    expect(rows).toEqual([{ name: toRename }]);
  });

  it("deactivateCatalog flips isActive to false, keeps the row, and writes METHOD_DEACTIVATED", async () => {
    const name = uniqueName("ELISA");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { deactivateCatalog } = await import(
      "../../../src/modules/catalog/server/deactivate-catalog.action"
    );

    const created = await createCatalog({ kind: "metodos", name }, req(adminHeaders, tenantA));

    const result = await deactivateCatalog({ kind: "metodos", id: created.id }, req(adminHeaders, tenantA));
    expect(result.id).toBe(created.id);

    // No hard delete — the row is still there, just inactive.
    const { rows: methodRows } = await owner.query(
      'SELECT name, "isActive" FROM "method" WHERE id = $1',
      [created.id],
    );
    expect(methodRows).toEqual([{ name, isActive: false }]);

    const { rows: auditRows } = await owner.query(
      'SELECT entity, action, before, after FROM "audit_log" WHERE "entityId" = $1 AND action = $2',
      [created.id, "METHOD_DEACTIVATED"],
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      entity: "Method",
      action: "METHOD_DEACTIVATED",
      before: { isActive: true },
      after: { isActive: false },
    });
  });

  it("reactivateCatalog flips isActive back to true and writes METHOD_REACTIVATED", async () => {
    const name = uniqueName("ELISA");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { deactivateCatalog } = await import(
      "../../../src/modules/catalog/server/deactivate-catalog.action"
    );
    const { reactivateCatalog } = await import(
      "../../../src/modules/catalog/server/reactivate-catalog.action"
    );

    const created = await createCatalog({ kind: "metodos", name }, req(adminHeaders, tenantA));
    await deactivateCatalog({ kind: "metodos", id: created.id }, req(adminHeaders, tenantA));

    const result = await reactivateCatalog({ kind: "metodos", id: created.id }, req(adminHeaders, tenantA));
    expect(result.id).toBe(created.id);

    const { rows: methodRows } = await owner.query(
      'SELECT "isActive" FROM "method" WHERE id = $1',
      [created.id],
    );
    expect(methodRows).toEqual([{ isActive: true }]);

    const { rows: auditRows } = await owner.query(
      'SELECT entity, action, before, after FROM "audit_log" WHERE "entityId" = $1 AND action = $2',
      [created.id, "METHOD_REACTIVATED"],
    );
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      entity: "Method",
      action: "METHOD_REACTIVATED",
      before: { isActive: false },
      after: { isActive: true },
    });
  });

  it("deactivating an already-inactive row is a no-op — no mutation, no audit row", async () => {
    const name = uniqueName("ELISA");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { deactivateCatalog } = await import(
      "../../../src/modules/catalog/server/deactivate-catalog.action"
    );

    const created = await createCatalog({ kind: "metodos", name }, req(adminHeaders, tenantA));
    await deactivateCatalog({ kind: "metodos", id: created.id }, req(adminHeaders, tenantA));

    // Second deactivate on the same (now inactive) row: returns the id, no new audit.
    const result = await deactivateCatalog({ kind: "metodos", id: created.id }, req(adminHeaders, tenantA));
    expect(result.id).toBe(created.id);

    const { rows: auditRows } = await owner.query(
      'SELECT action FROM "audit_log" WHERE "entityId" = $1',
      [created.id],
    );
    // Only ONE METHOD_DEACTIVATED: the second deactivate was a no-op. The
    // entityId also carries the METHOD_CREATED audit from the initial create.
    expect(auditRows.map((r) => r.action)).toEqual([
      "METHOD_CREATED",
      "METHOD_DEACTIVATED",
    ]);
  });

  it("reactivating an already-active row is a no-op — no mutation, no audit row", async () => {
    const name = uniqueName("PCR");
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );
    const { reactivateCatalog } = await import(
      "../../../src/modules/catalog/server/reactivate-catalog.action"
    );

    const created = await createCatalog({ kind: "metodos", name }, req(adminHeaders, tenantA));

    const result = await reactivateCatalog({ kind: "metodos", id: created.id }, req(adminHeaders, tenantA));
    expect(result.id).toBe(created.id);

    const { rows: auditRows } = await owner.query(
      'SELECT action FROM "audit_log" WHERE "entityId" = $1',
      [created.id],
    );
    expect(auditRows).toEqual([{ action: "METHOD_CREATED" }]);
  });

  it("a quimico createCatalog attempt is rejected 403 and logged CATALOG_ADMIN_ACTION_DENIED", async () => {
    const { createCatalog } = await import(
      "../../../src/modules/catalog/server/create-catalog.action"
    );

    await expect(
      createCatalog({ kind: "metodos", name: uniqueName("BLOQUEADO") }, req(quimicoHeaders, tenantA)),
    ).rejects.toMatchObject({ status: 403 });

    const { rows } = await owner.query(
      'SELECT entity, action, "entityId", after FROM "audit_log" WHERE "actorUserId" = $1',
      [quimicoUserId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity: "Method",
      action: "CATALOG_ADMIN_ACTION_DENIED",
      entityId: quimicoUserId,
      after: { attemptedAction: "CATALOG_CREATE" },
    });
  });

  it("a recepcionista deactivateCatalog attempt is rejected 403, logged with the target entityId, and the row stays active", async () => {
    const targetId = await seedMethodRow(tenantA, uniqueName("TARGET"));

    const { deactivateCatalog } = await import(
      "../../../src/modules/catalog/server/deactivate-catalog.action"
    );

    await expect(
      deactivateCatalog({ kind: "metodos", id: targetId }, req(recepcionistaHeaders, tenantA)),
    ).rejects.toMatchObject({ status: 403 });

    const { rows } = await owner.query(
      'SELECT entity, action, "entityId", after FROM "audit_log" WHERE "actorUserId" = $1',
      [recepcionistaUserId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity: "Method",
      action: "CATALOG_ADMIN_ACTION_DENIED",
      entityId: targetId,
      after: { attemptedAction: "CATALOG_DEACTIVATE" },
    });

    // The denial happened BEFORE any mutation — the target was not deactivated.
    const { rows: targetRows } = await owner.query(
      'SELECT "isActive" FROM "method" WHERE id = $1',
      [targetId],
    );
    expect(targetRows[0].isActive).toBe(true);
  });

  it("listCatalogRows returns only the tenant's own rows ordered by name ascending (AD-2/AD-3)", async () => {
    const isoA = await newTenant();
    const isoB = await newTenant();
    await seedMethodRow(isoA, "ZEBRA");
    await seedMethodRow(isoA, "ALFA");
    await seedMethodRow(isoA, "MIKO");
    await seedMethodRow(isoB, "AAAA-FOREIGN");
    // One inactive row: list must include it, countActive must not.
    const inactiveId = await seedMethodRow(isoA, "INACTIVO");
    await owner.query('UPDATE "method" SET "isActive" = false WHERE id = $1', [inactiveId]);

    const { listCatalogRows, countActive } = await import(
      "../../../src/modules/catalog/server/catalog-queries"
    );

    const rows = await listCatalogRows("metodos", { tenantId: isoA, role: "admin" });
    expect(rows.map((r) => r.values.name)).toEqual(["ALFA", "INACTIVO", "MIKO", "ZEBRA"]);
    expect(rows.every((r) => r.values.name !== "AAAA-FOREIGN")).toBe(true);
    expect(rows.find((r) => r.values.name === "INACTIVO")?.isActive).toBe(false);

    expect(await countActive("metodos", { tenantId: isoA, role: "admin" })).toBe(3);
  });

  it("getCatalogStats counts only active rows per catalog kind for the tenant", async () => {
    const statsTenant = await newTenant();
    const m1 = await seedMethodRow(statsTenant, "M1");
    await seedMethodRow(statsTenant, "M2");
    await owner.query('UPDATE "method" SET "isActive" = false WHERE id = $1', [m1]);
    await owner.query(
      `INSERT INTO "technique" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [`technique-stats-${randomUUID()}`, statsTenant, "T1"],
    );

    const { getCatalogStats } = await import(
      "../../../src/modules/catalog/server/catalog-queries"
    );

    const stats = await getCatalogStats({ tenantId: statsTenant, role: "admin" });
    expect(stats).toEqual({
      metodos: 1, // m2 active; m1 deactivated
      tecnicas: 1,
      equipos: 0,
      recipientes: 0,
      "tipos-de-muestra": 0,
    });
  });
});
