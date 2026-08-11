/**
 * Phase 5.3 — `src/shared/db/bootstrap.ts` (D3, MODE 2). Proves the ONLY
 * unscoped read in the codebase resolves exactly `{ id, isActive }` by slug
 * and nothing else, against a real Postgres branch (no mocks,
 * tenant-isolation spec).
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

let owner: Client;
let tenantId: string;
let slug: string;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantId = `tenant-bootstrap-${randomUUID()}`;
  slug = `lab-bootstrap-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, slug, "Bootstrap Lab"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe("src/shared/db bootstrap mode — narrow tenant resolution (D3)", () => {
  it("resolves id and isActive by slug, and nothing else", async () => {
    const { bootstrap } = await import("../../src/shared/db");

    const result = await bootstrap.resolveTenantBySlug(slug);

    expect(result).toEqual({ id: tenantId, isActive: true });
  });

  it("returns null for an unknown slug", async () => {
    const { bootstrap } = await import("../../src/shared/db");

    const result = await bootstrap.resolveTenantBySlug(`no-such-slug-${randomUUID()}`);

    expect(result).toBeNull();
  });
});
