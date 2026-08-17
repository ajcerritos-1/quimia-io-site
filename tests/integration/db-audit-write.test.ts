/**
 * Story 1.2 Task 2 — `writeAuditLog(tx, entry)`, the ONE write path every
 * module reuses to record an `AuditLog` row (AD-10 "single write path").
 * Must be callable INSIDE an existing `transaction()` callback so the audit
 * row commits in the exact same Postgres transaction as the mutation it is
 * recording (AD-4's "one wrapper call" pattern) — real Postgres, no mocks
 * (tenant-isolation spec).
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

let owner: Client;
let tenantId: string;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantId = `tenant-audit-write-${randomUUID()}`;
  await owner.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, `lab-audit-write-${randomUUID()}`, "Audit Write Lab"],
  );
});

afterAll(async () => {
  await owner.end();
});

describe("writeAuditLog (Task 2, AD-10 single write path)", () => {
  it("inserts one AuditLog row inside an existing transaction() callback", async () => {
    const { transaction, writeAuditLog } = await import("../../src/shared/db");
    const actorUserId = `actor-${randomUUID()}`;
    const entityId = `entity-${randomUUID()}`;

    await transaction({ tenantId, role: "admin" }, async (tx) => {
      await writeAuditLog(tx, {
        tenantId,
        entity: "User",
        entityId,
        action: "USER_CREATED",
        before: null,
        after: { role: "admin" },
        actorUserId,
      });
    });

    const { rows } = await owner.query(
      'SELECT "tenantId", entity, "entityId", action, before, after, "actorUserId" FROM "audit_log" WHERE "entityId" = $1',
      [entityId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenantId,
      entity: "User",
      entityId,
      action: "USER_CREATED",
      before: null,
      after: { role: "admin" },
      actorUserId,
    });
  });

  it("commits in the SAME transaction as another write — a rollback discards both", async () => {
    const { transaction, writeAuditLog } = await import("../../src/shared/db");
    const entityId = `entity-rollback-${randomUUID()}`;

    await expect(
      transaction({ tenantId, role: "admin" }, async (tx) => {
        await writeAuditLog(tx, {
          tenantId,
          entity: "User",
          entityId,
          action: "USER_CREATED",
          before: null,
          after: null,
          actorUserId: `actor-${randomUUID()}`,
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const { rows } = await owner.query(
      'SELECT id FROM "audit_log" WHERE "entityId" = $1',
      [entityId],
    );
    expect(rows).toHaveLength(0);
  });

  it("omits before/after entirely when not provided — column stays NULL", async () => {
    const { transaction, writeAuditLog } = await import("../../src/shared/db");
    const entityId = `entity-omit-${randomUUID()}`;

    await transaction({ tenantId, role: "admin" }, async (tx) => {
      await writeAuditLog(tx, {
        tenantId,
        entity: "User",
        entityId,
        action: "USER_ADMIN_ACTION_DENIED",
        actorUserId: `actor-${randomUUID()}`,
      });
    });

    const { rows } = await owner.query(
      'SELECT before, after FROM "audit_log" WHERE "entityId" = $1',
      [entityId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].before).toBeNull();
    expect(rows[0].after).toBeNull();
  });
});
