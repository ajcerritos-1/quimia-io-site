/**
 * Story 2.2 (Slice 1/2) — `Container.color` contract (study-catalog R6,
 * AD-21). Proves, on a real ephemeral Neon branch with no mocks, that a tube
 * container persists its colour name, that a non-tube container stores NULL,
 * and that the non-owner app role `quimia_app` can read and write `color` with
 * no additional GRANT or RLS policy (the 2.1 table-level grant covers it).
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

let owner: Client;
let app: Client;
let tenantId: string;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  app = new Client({ connectionString: inject("appDatabaseUrl") });
  await owner.connect();
  await app.connect();
  tenantId = `tenant-container-color-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-container-color-${randomUUID()}`, "Container Color Lab"],
  );
});

afterAll(async () => {
  await owner.end();
  await app.end();
});

describe("Container.color — AD-21 nullable tube colour (R6)", () => {
  it('a tube container "tubo lila EDTA" persists color "lila"', async () => {
    const id = `ct-lila-${randomUUID()}`;
    await owner.query(
      `SELECT set_config('app.tenant_id', $1, false)`,
      [tenantId],
    );
    await owner.query(
      `INSERT INTO "container" (id, "tenantId", name, color, "updatedAt") VALUES ($1, $2, $3, $4, now())`,
      [id, tenantId, "tubo lila EDTA", "lila"],
    );
    const { rows } = await owner.query<{ color: string | null }>(
      `SELECT color FROM "container" WHERE id = $1`,
      [id],
    );
    expect(rows[0].color).toBe("lila");
  });

  it('a non-tube container "Frasco" created without color stores NULL', async () => {
    const id = `ct-frasco-${randomUUID()}`;
    await owner.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
    await owner.query(
      `INSERT INTO "container" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [id, tenantId, `Frasco ${randomUUID()}`],
    );
    const { rows } = await owner.query<{ color: string | null }>(
      `SELECT color FROM "container" WHERE id = $1`,
      [id],
    );
    expect(rows[0].color).toBeNull();
  });

  it("quimia_app reads and writes color with no new GRANT and no new policy", async () => {
    const id = `ct-app-${randomUUID()}`;
    await app.query("BEGIN");
    try {
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await app.query(
        `INSERT INTO "container" (id, "tenantId", name, color, "updatedAt") VALUES ($1, $2, $3, $4, now())`,
        [id, tenantId, "tubo amarillo SST", "amarillo"],
      );
      await app.query(`UPDATE "container" SET color = $1 WHERE id = $2`, ["rojo", id]);
      const { rows } = await app.query<{ color: string | null }>(
        `SELECT color FROM "container" WHERE id = $1`,
        [id],
      );
      expect(rows[0].color).toBe("rojo");
      await app.query("COMMIT");
    } catch (err) {
      await app.query("ROLLBACK");
      throw err;
    }
  });
});
