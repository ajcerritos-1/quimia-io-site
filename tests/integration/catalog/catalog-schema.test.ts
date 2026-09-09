/**
 * Story 2.1 (Change 1/6) — `catalog_supporting_models` schema contract
 * (R1, R3, R4, R7-cuid2). Proves, on a real ephemeral Neon branch with no
 * mocks, that the five catalog tables exist with the EXACT locked column set
 * (R1, no fields beyond the contract); that `(tenantId, name)` uniqueness is
 * per tenant (23505 within a tenant, allowed across tenants — AD-8); that
 * `Equipment` without `calibrationDate` stores NULL (FR-9); that `Container`
 * carries catalog-lookup columns only (R4 / AD-6 — no order/tube identity);
 * that `isActive` defaults true and a deactivated row persists (R3); and
 * that ids are cuid2, unique per row, generated through the real `scoped()`
 * wrapper (R7 — the only test that goes through Prisma, because cuid2 is
 * generated client-side and the DB column has no default, design.md).
 */
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

const LOCKED_COLUMNS = ["id", "tenantId", "name", "isActive", "createdAt", "updatedAt"];
const EQUIPMENT_COLUMNS = [
  "id",
  "tenantId",
  "name",
  "model",
  "serialNumber",
  "calibrationDate",
  "isActive",
  "createdAt",
  "updatedAt",
];

let owner: Client;
let tenantA: string;
let tenantB: string;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantA = `tenant-cat-schema-a-${randomUUID()}`;
  tenantB = `tenant-cat-schema-b-${randomUUID()}`;
  for (const [id, label] of [
    [tenantA, "a"],
    [tenantB, "b"],
  ] as const) {
    await owner.query(
      `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [id, `lab-cat-schema-${label}-${randomUUID()}`, `Catalog Schema Lab ${label}`],
    );
  }
});

afterAll(async () => {
  await owner.end();
});

describe("catalog_supporting_models migration — schema contract (R1, R3, R4, R5, R7)", () => {
  it("the migration seeds no rows — a fresh branch starts empty (R5)", () => {
    // Deterministic R5 proof. A shared-branch harness (one ephemeral branch
    // per run, file order by size/duration in Vitest) makes a literal
    // "fresh branch zero rows" DB assertion order-dependent — the other
    // catalog test file's seeds may already be present when this file runs.
    // The ONLY writers on a fresh branch are migrations and tests, so
    // asserting the migration contains no seed statements (INSERT/COPY)
    // proves the requirement "the migration SHOULD NOT insert seed rows"
    // exactly and stably (deviation from design.md's dynamic variant, noted
    // in apply-progress).
    const migrationsDir = join(process.cwd(), "prisma", "migrations");
    const migrationDir = readdirSync(migrationsDir).find((d) =>
      d.endsWith("_catalog_supporting_models"),
    );
    expect(migrationDir, "catalog_supporting_models migration exists").toBeDefined();
    const sql = readFileSync(join(migrationsDir, migrationDir!, "migration.sql"), "utf8");

    expect(sql).not.toMatch(/INSERT\s+INTO/i);
    expect(sql).not.toMatch(/^\s*COPY\b/im);
  });

  it("all five tables exist with the locked column set (R1)", async () => {
    const expectedByTable: Array<[string, readonly string[]]> = [
      ["method", LOCKED_COLUMNS],
      ["technique", LOCKED_COLUMNS],
      ["equipment", EQUIPMENT_COLUMNS],
      ["container", LOCKED_COLUMNS],
      ["sample_type", LOCKED_COLUMNS],
    ];
    for (const [table, expected] of expectedByTable) {
      const { rows } = await owner.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table],
      );
      expect(rows.map((r) => r.column_name), `${table} exact column set`).toEqual([
        ...expected,
      ]);
    }
  });

  it("_prisma_migrations lists catalog_supporting_models (task 2.4)", async () => {
    const { rows } = await owner.query<{ migration_name: string }>(
      "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name",
    );
    expect(rows.map((r) => r.migration_name)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("catalog_supporting_models"),
      ]),
    );
  });

  it("duplicate (tenantId, name) within a tenant is rejected with 23505 (R1)", async () => {
    await owner.query(
      `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [`method-dup-${randomUUID()}`, tenantA, "QUIMICA SANGUINEA"],
    );
    await expect(
      owner.query(
        `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
        [`method-dup-${randomUUID()}`, tenantA, "QUIMICA SANGUINEA"],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("the same name across two tenants is allowed (R1, AD-8 per-tenant uniqueness)", async () => {
    const id = `method-cross-${randomUUID()}`;
    await owner.query(
      `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [id, tenantB, "QUIMICA SANGUINEA"],
    );
    const { rows } = await owner.query<{ id: string }>(
      'SELECT id FROM "method" WHERE id = $1',
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
  });

  it("Equipment without calibrationDate stores NULL (R1, FR-9)", async () => {
    const id = `equip-null-${randomUUID()}`;
    await owner.query(
      `INSERT INTO "equipment" (id, "tenantId", name, model, "serialNumber", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now())`,
      [id, tenantA, "Centrifuga", "Z206A", `SN-${randomUUID()}`],
    );
    const { rows } = await owner.query<{ calibrationDate: Date | null }>(
      'SELECT "calibrationDate" FROM "equipment" WHERE id = $1',
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].calibrationDate).toBeNull();
  });

  it("Container carries only the locked catalog columns — no order/tube identity (R4, AD-6)", async () => {
    const { rows } = await owner.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'container' ORDER BY ordinal_position`,
    );
    expect(rows.map((r) => r.column_name)).toEqual([...LOCKED_COLUMNS]);
  });

  it("isActive defaults true and a deactivated row persists (R3)", async () => {
    const id = `method-deact-${randomUUID()}`;
    await owner.query(
      `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [id, tenantA, "ELISA"],
    );
    const { rows: fresh } = await owner.query<{ isActive: boolean }>(
      'SELECT "isActive" FROM "method" WHERE id = $1',
      [id],
    );
    expect(fresh).toHaveLength(1);
    expect(fresh[0].isActive).toBe(true);

    await owner.query('UPDATE "method" SET "isActive" = false WHERE id = $1', [id]);
    const { rows: deactivated } = await owner.query<{ isActive: boolean }>(
      'SELECT "isActive" FROM "method" WHERE id = $1',
      [id],
    );
    expect(deactivated).toHaveLength(1);
    expect(deactivated[0].isActive).toBe(false);
  });

  it("ids are cuid2, unique per row, via scoped() (R7)", async () => {
    // The only test going through the real Prisma wrapper: cuid2 is generated
    // client-side (the DB column has no default), so raw SQL cannot exercise
    // it. `scoped()` runs as quimia_app with app.tenant_id set, which is
    // exactly how the app writes these rows in production.
    const { scoped } = await import("../../../src/shared/db");
    const db = scoped({ tenantId: tenantA, role: "admin" });

    const method = await db.method.create({
      data: { tenantId: tenantA, name: "CUID2 METHOD" },
    });
    const technique = await db.technique.create({
      data: { tenantId: tenantA, name: "CUID2 TECHNIQUE" },
    });
    const equipment = await db.equipment.create({
      data: {
        tenantId: tenantA,
        name: "CUID2 EQUIPMENT",
        model: "M1",
        serialNumber: `SN-${randomUUID()}`,
      },
    });
    const container = await db.container.create({
      data: { tenantId: tenantA, name: "CUID2 CONTAINER" },
    });
    const sampleType = await db.sampleType.create({
      data: { tenantId: tenantA, name: "CUID2 SAMPLE" },
    });

    const ids = [method.id, technique.id, equipment.id, container.id, sampleType.id];
    expect(new Set(ids).size, "five distinct ids").toBe(5);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]{24}$/);
    }
  });
});