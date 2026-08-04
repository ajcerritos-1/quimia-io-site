/**
 * Phase 3.4 smoke check: proves the Neon ephemeral-branch harness itself
 * works end-to-end (branch create -> migrate deploy -> provision-app-role
 * -> connect -> teardown) — NOT a behavioral RLS proof (that's Phase 5's
 * job, tasks 5.1/5.2, once `src/shared/db` exists). The harness is
 * TDD-exempt scaffolding (design.md), so this is a smoke test, not a
 * RED-authored spec test — but it is real, automated, and repeatable: it
 * runs against the actual ephemeral branch `tests/setup/neon-global-setup.ts`
 * creates for this run, via `npm run test:integration`.
 */
import { Client } from "pg";
import { inject } from "vitest";
import { describe, expect, it } from "vitest";

describe("Neon ephemeral-branch harness", () => {
  it("connects as the quimia_app role over the pooled URL provided by globalSetup", async () => {
    const client = new Client({ connectionString: inject("appDatabaseUrl") });
    await client.connect();
    try {
      const { rows } = await client.query<{ current_user: string }>(
        "SELECT current_user",
      );
      expect(rows[0].current_user).toBe("quimia_app");
    } finally {
      await client.end();
    }
  });

  it("has both migrations applied on the fresh branch (init + rls_roles)", async () => {
    const client = new Client({ connectionString: inject("ownerDatabaseUrl") });
    await client.connect();
    try {
      const { rows } = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' ORDER BY table_name`,
      );
      const tableNames = rows.map((r) => r.table_name);
      expect(tableNames).toEqual(
        expect.arrayContaining([
          "tenant",
          "user",
          "session",
          "account",
          "verification",
        ]),
      );

      const { rows: migrationRows } = await client.query<{ migration_name: string }>(
        `SELECT migration_name FROM _prisma_migrations ORDER BY migration_name`,
      );
      expect(migrationRows.map((r) => r.migration_name)).toEqual(
        expect.arrayContaining([
          expect.stringContaining("_init"),
          expect.stringContaining("_rls_roles"),
        ]),
      );
    } finally {
      await client.end();
    }
  });

  it("has FORCE ROW LEVEL SECURITY enabled on the user table (D5)", async () => {
    const client = new Client({ connectionString: inject("ownerDatabaseUrl") });
    await client.connect();
    try {
      const { rows } = await client.query<{
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
         WHERE relname = 'user' AND relnamespace = 'public'::regnamespace`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].relrowsecurity).toBe(true);
      expect(rows[0].relforcerowsecurity).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("provisioned quimia_app with only the column-narrow grant on tenant (D3)", async () => {
    const client = new Client({ connectionString: inject("appDatabaseUrl") });
    await client.connect();
    try {
      // Column-narrow grant means selecting a non-granted column must fail.
      await expect(
        client.query('SELECT "name" FROM "tenant" LIMIT 1'),
      ).rejects.toThrow(/permission denied/i);

      // The granted columns must still be selectable.
      await expect(
        client.query('SELECT "id", "slug", "isActive" FROM "tenant" LIMIT 1'),
      ).resolves.toBeDefined();
    } finally {
      await client.end();
    }
  });

  it("unscoped app-role query on a FORCE-RLS table returns zero rows, fail-closed (tenant-isolation spec)", async () => {
    const owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
    await owner.connect();
    try {
      await owner.query(
        `INSERT INTO "tenant" (id, slug, name, "updatedAt")
         VALUES ('smoke-tenant-1', 'smoke-lab-1', 'Smoke Lab 1', now())`,
      );
      await owner.query(
        `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
         VALUES ('smoke-user-1', 'smoke-tenant-1', 'smoke@example.com', 'smokeuser', 'Smoke User', 'admin', now())`,
      );
    } finally {
      await owner.end();
    }

    const app = new Client({ connectionString: inject("appDatabaseUrl") });
    await app.connect();
    try {
      // No `app.tenant_id` set on this connection -> current_setting(...) is
      // NULL -> "tenantId" = NULL is NULL -> zero rows, not all rows.
      const { rows } = await app.query('SELECT * FROM "user"');
      expect(rows).toHaveLength(0);
    } finally {
      await app.end();
    }
  });
});
