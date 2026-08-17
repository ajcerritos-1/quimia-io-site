/**
 * Task 1 (Story 1.2, AD-10, NFR-7) — `audit_log` must be demonstrably
 * IMMUTABLE at the Postgres privilege level, not merely by application-code
 * convention: `quimia_app` gets SELECT + INSERT only, no UPDATE/DELETE grant
 * at all. A bug or a future dev writing raw SQL cannot bypass this the way
 * an app-layer check could be bypassed. Real ephemeral Neon branch, no
 * mocked client (tenant-isolation spec).
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

let owner: Client;
let app: Client;
const tenantId = `tenant-audit-${randomUUID()}`;

async function insertAuditRow(client: Client, id: string): Promise<void> {
  await client.query(
    `INSERT INTO "audit_log"
       (id, "tenantId", entity, "entityId", action, "actorUserId", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [id, tenantId, "User", `entity-${randomUUID()}`, "USER_CREATED", `actor-${randomUUID()}`],
  );
}

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  app = new Client({ connectionString: inject("appDatabaseUrl") });
  await app.connect();
});

afterAll(async () => {
  await owner.end();
  await app.end();
});

describe('Postgres privileges on "audit_log" — immutable by grant, not app code (AD-10, NFR-7)', () => {
  it("quimia_app can INSERT a row when app.tenant_id matches (SELECT/INSERT are granted)", async () => {
    const id = `audit-insert-${randomUUID()}`;
    await app.query("BEGIN");
    try {
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await app.query("SELECT set_config('app.role', 'admin', true)");
      await insertAuditRow(app, id);
      await app.query("COMMIT");
    } catch (err) {
      await app.query("ROLLBACK").catch(() => {});
      throw err;
    }

    const { rows } = await owner.query('SELECT id FROM "audit_log" WHERE id = $1', [id]);
    expect(rows).toHaveLength(1);
  });

  it("quimia_app can SELECT rows within its own tenant scope", async () => {
    const id = `audit-select-${randomUUID()}`;
    await owner.query(
      `INSERT INTO "audit_log"
         (id, "tenantId", entity, "entityId", action, "actorUserId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [id, tenantId, "User", `entity-${randomUUID()}`, "USER_CREATED", `actor-${randomUUID()}`],
    );

    await app.query("BEGIN");
    try {
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await app.query("SELECT set_config('app.role', 'admin', true)");
      const { rows } = await app.query('SELECT id FROM "audit_log" WHERE id = $1', [id]);
      expect(rows).toHaveLength(1);
      await app.query("COMMIT");
    } catch (err) {
      await app.query("ROLLBACK").catch(() => {});
      throw err;
    }
  });

  it("quimia_app CANNOT UPDATE audit_log — no UPDATE grant exists at all (permission denied, not RLS)", async () => {
    const id = `audit-update-${randomUUID()}`;
    await insertAuditRow(owner, id);

    await app.query("BEGIN");
    try {
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await app.query("SELECT set_config('app.role', 'admin', true)");
      await expect(
        app.query('UPDATE "audit_log" SET action = $1 WHERE id = $2', ["TAMPERED", id]),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await app.query("ROLLBACK").catch(() => {});
    }
  });

  it("quimia_app CANNOT DELETE audit_log — no DELETE grant exists at all (permission denied, not RLS)", async () => {
    const id = `audit-delete-${randomUUID()}`;
    await insertAuditRow(owner, id);

    await app.query("BEGIN");
    try {
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await app.query("SELECT set_config('app.role', 'admin', true)");
      await expect(
        app.query('DELETE FROM "audit_log" WHERE id = $1', [id]),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await app.query("ROLLBACK").catch(() => {});
    }
  });

  it("a fresh app-role connection with no app.tenant_id set reads zero rows (fail-closed RLS, D5)", async () => {
    const id = `audit-failclosed-${randomUUID()}`;
    await insertAuditRow(owner, id);

    const fresh = new Client({ connectionString: inject("appDatabaseUrl") });
    await fresh.connect();
    try {
      const { rows } = await fresh.query('SELECT * FROM "audit_log" WHERE id = $1', [id]);
      expect(rows).toHaveLength(0);
    } finally {
      await fresh.end();
    }
  });

});
