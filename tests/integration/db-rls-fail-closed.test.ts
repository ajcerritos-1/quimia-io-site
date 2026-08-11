/**
 * Phase 5.2 — confirms two RLS policy properties `src/shared/db` depends on
 * but does not itself implement: the policy lives in the `rls_roles`
 * migration (PR 1). `harness-smoke.test.ts` (Phase 3.4) already smoke-checked
 * the fail-closed SELECT case at the harness level; this file re-proves it
 * with the wrapper's own seed shape and adds the `WITH CHECK` / cross-tenant
 * INSERT case, which nothing before Phase 5 has covered — real Postgres, no
 * mocks (tenant-isolation spec).
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

let owner: Client;
let tenantA: string;
let tenantB: string;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantA = `tenant-fc-a-${randomUUID()}`;
  tenantB = `tenant-fc-b-${randomUUID()}`;
  for (const [id, label] of [
    [tenantA, "a"],
    [tenantB, "b"],
  ] as const) {
    await owner.query(
      `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [id, `lab-fc-${label}-${randomUUID()}`, `Lab FC ${label}`],
    );
  }
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'admin', now())`,
    [`user-fc-a-${randomUUID()}`, tenantA, "fc-a@example.com", "fcusera", "FC User A"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe('Postgres RLS policy on "user" — fail-closed reads + WITH CHECK writes (D5, AD-2)', () => {
  it("a fresh app-role connection with no app.tenant_id set reads zero rows", async () => {
    const app = new Client({ connectionString: inject("appDatabaseUrl") });
    await app.connect();
    try {
      const { rows } = await app.query('SELECT * FROM "user"');
      expect(rows).toHaveLength(0);
    } finally {
      await app.end();
    }
  });

  it("WITH CHECK blocks an app-role insert whose tenantId does not match app.tenant_id", async () => {
    const app = new Client({ connectionString: inject("appDatabaseUrl") });
    await app.connect();
    try {
      await app.query("BEGIN");
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      await app.query("SELECT set_config('app.role', 'admin', true)");

      await expect(
        app.query(
          `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'admin', now())`,
          [`user-fc-b-${randomUUID()}`, tenantB, "fc-b@example.com", "fcuserb", "FC User B"],
        ),
      ).rejects.toThrow(/row-level security|violates/i);
    } finally {
      await app.query("ROLLBACK").catch(() => {});
      await app.end();
    }
  });

  it("the same transaction succeeds when tenantId matches app.tenant_id", async () => {
    const app = new Client({ connectionString: inject("appDatabaseUrl") });
    await app.connect();
    try {
      await app.query("BEGIN");
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      await app.query("SELECT set_config('app.role', 'admin', true)");

      await expect(
        app.query(
          `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'admin', now())`,
          [`user-fc-a2-${randomUUID()}`, tenantA, "fc-a2@example.com", "fcusera2", "FC User A2"],
        ),
      ).resolves.toBeDefined();
      await app.query("COMMIT");
    } finally {
      await app.end();
    }
  });
});
