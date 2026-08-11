/**
 * Phase 5.4 — `src/shared/db/{ambient,index}.ts` (D1, the Better Auth
 * binding). `ambient.ts` was implemented alongside `scoped.ts`/`bootstrap.ts`
 * in Phase 5.1's commit (index.ts, the sole export surface, needs every
 * wrapper module to compile as one unit) -- this is confirmation evidence
 * against a real Neon branch, not a RED-first cycle for new code: proves the
 * Proxy throws with no active tenant context, and delegates to `scoped(ctx)`
 * for the request context's tenant when one IS active.
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { runWithContext } from "../../src/shared/context/request-context";

let owner: Client;
let tenantId: string;
let userId: string;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantId = `tenant-ambient-${randomUUID()}`;
  userId = `user-ambient-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-ambient-${randomUUID()}`, "Ambient Lab"],
  );
  await owner.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'admin', now())`,
    [userId, tenantId, "ambient@example.com", "ambientuser", "Ambient User"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe("src/shared/db ambient proxy — the Better Auth binding (D1)", () => {
  it("throws when accessed outside runWithContext — no tenant context (AD-3: no unscoped fallback)", async () => {
    const { authPrisma } = await import("../../src/shared/db");

    expect(() => authPrisma.user).toThrow(/context/i);
  });

  it("delegates to scoped(ctx) for the active request context's tenant", async () => {
    const { authPrisma } = await import("../../src/shared/db");

    const rows = await runWithContext(
      { requestId: "req-ambient", tenant: { tenantId, role: "admin" } },
      () => authPrisma.user.findMany(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(userId);
  });
});
