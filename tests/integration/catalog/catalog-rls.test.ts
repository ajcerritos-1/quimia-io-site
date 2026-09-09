/**
 * Story 2.1 (Change 1/6) — `catalog_supporting_models` migration RLS contract
 * (R2, R7). Proves, on a real ephemeral Neon branch with no mocks
 * (tenant-isolation spec), that each of the five catalog tables ships with
 * ENABLE + FORCE ROW LEVEL SECURITY and a `tenant_isolation` policy on
 * `current_setting('app.tenant_id', true)`; that an unscoped app-role query
 * is fail-closed; that a tenant-scoped query never sees another tenant's
 * rows; and that `quimia_app` holds the full CRUD grant (User precedent —
 * "deactivate, never delete" is an app rule, not a grant revocation).
 *
 * Owner-bypass scenario (R2 "Owner cannot bypass isolation") is proven
 * STRUCTURALLY via `pg_class.relforcerowsecurity` (design.md deviation note):
 * the literal owner-SELECT-zero-rows is not reproducible on this harness
 * because Neon's branch-owner role demonstrably bypasses RLS (every existing
 * test seeds via the owner with no tenant context). `relforcerowsecurity =
 * true` is the exact Postgres property that removes the owner's implicit
 * bypass, asserted identically to `harness-smoke.test.ts`.
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

const CATALOG_TABLES = [
  "method",
  "technique",
  "equipment",
  "container",
  "sample_type",
] as const;

let owner: Client;
let tenantA: string;
let tenantB: string;
let isoTenantA: string;
let isoTenantB: string;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  // Shared tenants for fail-closed / grant tests.
  tenantA = `tenant-cat-rls-a-${randomUUID()}`;
  tenantB = `tenant-cat-rls-b-${randomUUID()}`;
  // DEDICATED tenants for the isolation test — no other test seeds rows for
  // them, so a tenant-scoped `SELECT *` on the table returns exactly its own
  // row (the cross-tenant assertion stays deterministic regardless of the
  // serial file order inside the shared branch).
  isoTenantA = `tenant-cat-rls-iso-a-${randomUUID()}`;
  isoTenantB = `tenant-cat-rls-iso-b-${randomUUID()}`;
  for (const [id, label] of [
    [tenantA, "a"],
    [tenantB, "b"],
    [isoTenantA, "iso-a"],
    [isoTenantB, "iso-b"],
  ] as const) {
    await owner.query(
      `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [id, `lab-cat-rls-${label}-${randomUUID()}`, `Catalog RLS Lab ${label}`],
    );
  }
});

afterAll(async () => {
  await owner.end();
});

describe("catalog_supporting_models migration — RLS contract (R2, R7)", () => {
  it("every catalog table has ENABLE + FORCE RLS and a tenant_isolation policy (R2)", async () => {
    for (const table of CATALOG_TABLES) {
      const { rows: classRows } = await owner.query<{
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
         WHERE relname = $1 AND relnamespace = 'public'::regnamespace`,
        [table],
      );
      expect(classRows, `${table} exists in pg_class`).toHaveLength(1);
      expect(classRows[0].relrowsecurity, `${table} ENABLE RLS`).toBe(true);
      expect(classRows[0].relforcerowsecurity, `${table} FORCE RLS`).toBe(true);

      const { rows: policies } = await owner.query<{
        policyname: string;
        qual: string | null;
        with_check: string | null;
      }>(
        `SELECT policyname, qual, with_check FROM pg_policies
         WHERE schemaname = 'public' AND tablename = $1`,
        [table],
      );
      // pg_policies expands one row per command the policy applies to
      // (SELECT/INSERT/UPDATE/DELETE): the USING expression lives on `qual`,
      // the WITH CHECK expression on `with_check` (NULL on the rows where
      // that branch does not apply). `.some()` over the policy's command
      // rows proves the effective predicate regardless of view row order.
      const isolationRows = policies.filter(
        (p) => p.policyname === "tenant_isolation",
      );
      expect(isolationRows, `${table} has a tenant_isolation policy`).not.toHaveLength(0);
      expect(
        isolationRows.some((p) => p.qual?.includes("app.tenant_id")),
        `${table} USING (read-path) predicate reads app.tenant_id`,
      ).toBe(true);
      // Review-fix (adversarial review, R1): the write path was unproven.
      // WITH CHECK is the INSERT/UPDATE enforcement branch — a policy whose
      // WITH CHECK did not scope to app.tenant_id would let a tenant insert
      // rows owned by another tenant. Assert it is present on all 5 tables.
      expect(
        isolationRows.some((p) => p.with_check?.includes("app.tenant_id")),
        `${table} WITH CHECK (write-path) predicate reads app.tenant_id`,
      ).toBe(true);
    }
  });

  it("relforcerowsecurity is true on all five tables — owner cannot bypass (R2)", async () => {
    const { rows } = await owner.query<{
      relname: string;
      relforcerowsecurity: boolean;
    }>(
      `SELECT relname, relforcerowsecurity FROM pg_class
       WHERE relname = ANY($1) AND relnamespace = 'public'::regnamespace`,
      [CATALOG_TABLES],
    );
    expect(rows).toHaveLength(CATALOG_TABLES.length);
    for (const row of rows) {
      expect(row.relforcerowsecurity, `${row.relname} FORCE RLS`).toBe(true);
    }
  });

  it("an unscoped app-role SELECT returns zero rows — fail-closed (R2)", async () => {
    // Seed a real row as the owner (owner bypasses RLS on this harness), then
    // prove quimia_app with NO app.tenant_id set sees none of it:
    // current_setting(..., true) is NULL -> "tenantId" = NULL is NULL -> zero
    // rows, never all rows.
    await owner.query(
      `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [`method-failclosed-${randomUUID()}`, tenantA, "FAIL CLOSED"],
    );

    const app = new Client({ connectionString: inject("appDatabaseUrl") });
    await app.connect();
    try {
      const { rows } = await app.query('SELECT * FROM "method"');
      expect(rows).toHaveLength(0);
    } finally {
      await app.end();
    }
  });

  it("a tenant-scoped SELECT returns zero other-tenant rows (R2 cross-tenant isolation)", async () => {
    await owner.query(
      `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [`method-iso-a-${randomUUID()}`, isoTenantA, `ISO-A-${randomUUID()}`],
    );
    await owner.query(
      `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [`method-iso-b-${randomUUID()}`, isoTenantB, `ISO-B-${randomUUID()}`],
    );

    const app = new Client({ connectionString: inject("appDatabaseUrl") });
    await app.connect();
    try {
      await app.query("BEGIN");
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [isoTenantA]);
      await app.query("SELECT set_config('app.role', 'admin', true)");

      const { rows } = await app.query<{ tenantId: string }>(
        'SELECT "tenantId" FROM "method"',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].tenantId).toBe(isoTenantA);
      await app.query("COMMIT");
    } finally {
      await app.query("ROLLBACK").catch(() => {});
      await app.end();
    }
  });

  it("quimia_app can SELECT/INSERT/UPDATE/DELETE within its own tenant (R7 full grant surface)", async () => {
    const app = new Client({ connectionString: inject("appDatabaseUrl") });
    await app.connect();
    const id = `method-grant-${randomUUID()}`;
    try {
      await app.query("BEGIN");
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      await app.query("SELECT set_config('app.role', 'admin', true)");

      await app.query(
        `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
        [id, tenantA, "GRANT INSERT"],
      );
      const { rows: selected } = await app.query<{ name: string }>(
        'SELECT name FROM "method" WHERE id = $1',
        [id],
      );
      expect(selected).toHaveLength(1);
      expect(selected[0].name).toBe("GRANT INSERT");

      await app.query('UPDATE "method" SET name = $1 WHERE id = $2', ["GRANT UPDATED", id]);
      const { rows: updated } = await app.query<{ name: string }>(
        'SELECT name FROM "method" WHERE id = $1',
        [id],
      );
      expect(updated).toHaveLength(1);
      expect(updated[0].name).toBe("GRANT UPDATED");

      await app.query('DELETE FROM "method" WHERE id = $1', [id]);
      const { rows: afterDelete } = await app.query(
        'SELECT id FROM "method" WHERE id = $1',
        [id],
      );
      expect(afterDelete).toHaveLength(0);
      await app.query("COMMIT");
    } catch (err) {
      await app.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      await app.end();
    }
  });
});