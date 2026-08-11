/**
 * Phase 5.1 — RLS integration test for `src/shared/db`'s scoped mode (D5,
 * D6). Seeds two tenants directly via the owner-role connection (Neon's
 * branch-owner role is not subject to FORCE ROW LEVEL SECURITY — confirmed
 * by Phase 3.4's `harness-smoke.test.ts`), then proves `scoped()` and
 * `transaction()` — real Prisma Client Extension queries against a real
 * Postgres branch, no mocks (tenant-isolation spec) — only ever see the
 * tenant they were given.
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

interface SeededTenant {
  tenantId: string;
  userId: string;
}

let owner: Client;
let tenantA: SeededTenant;
let tenantB: SeededTenant;

async function seedTenant(client: Client, label: string): Promise<SeededTenant> {
  const tenantId = `tenant-scoped-${label}-${randomUUID()}`;
  const userId = `user-scoped-${label}-${randomUUID()}`;
  await client.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-scoped-${label}-${randomUUID()}`, `Scoped Lab ${label}`],
  );
  await client.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'admin', now())`,
    [userId, tenantId, `scoped-${label}@example.com`, `scopeduser${label}`, `Scoped User ${label}`],
  );
  return { tenantId, userId };
}

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantA = await seedTenant(owner, "a");
  tenantB = await seedTenant(owner, "b");
});

afterAll(async () => {
  await owner.end();
});

describe("src/shared/db scoped mode — tenant isolation", () => {
  it("a tenant-A scoped query returns only tenant-A's user, zero tenant-B rows", async () => {
    const { scoped } = await import("../../src/shared/db");
    const db = scoped({ tenantId: tenantA.tenantId, role: "admin" });

    const rows = await db.user.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(tenantA.userId);
    expect(rows.some((row) => row.id === tenantB.userId)).toBe(false);
  });

  it("switching context to tenant-B returns only tenant-B's user", async () => {
    const { scoped } = await import("../../src/shared/db");
    const db = scoped({ tenantId: tenantB.tenantId, role: "admin" });

    const rows = await db.user.findMany();

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(tenantB.userId);
  });

  it("transaction() sets the same context for every query inside the callback (D6)", async () => {
    const { transaction } = await import("../../src/shared/db");

    const result = await transaction(
      { tenantId: tenantA.tenantId, role: "admin" },
      (tx) => tx.user.findMany(),
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(tenantA.userId);
  });
});
