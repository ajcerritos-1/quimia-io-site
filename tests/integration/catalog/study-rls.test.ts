/**
 * Story 2.2 (slice 1/2) - RLS on `study` and `study_container` (spec R8), on a
 * real ephemeral Neon branch with no mocks. Proves ENABLE + FORCE RLS and the
 * `tenant_isolation` policy on both tables, fail-closed unscoped reads,
 * cross-tenant isolation, and the full `quimia_app` CRUD grant. Owner bypass
 * is proven structurally via `pg_class.relforcerowsecurity` (the Neon branch
 * owner bypasses RLS on this harness - same deviation as the 2.1 RLS test).
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  addContainer,
  createTenant,
  insertStudy,
  linkContainer,
  seedCatalogs,
} from "./study-fixtures";

const TABLES = ["study", "study_container"] as const;

let owner: Client;
let tenant: string;
let isoTenantA: string;
let isoTenantB: string;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenant = await createTenant(owner, "study-rls");
  isoTenantA = await createTenant(owner, "study-rls-iso-a");
  isoTenantB = await createTenant(owner, "study-rls-iso-b");
});

afterAll(async () => {
  await owner.end();
});

async function appClient(): Promise<Client> {
  const app = new Client({ connectionString: inject("appDatabaseUrl") });
  await app.connect();
  return app;
}

describe("study RLS contract (R8)", () => {
  it("study and study_container have ENABLE + FORCE RLS and a tenant_isolation policy", async () => {
    for (const table of TABLES) {
      const { rows: classRows } = await owner.query<{
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
         WHERE relname = $1 AND relnamespace = 'public'::regnamespace`,
        [table],
      );
      expect(classRows, `${table} exists`).toHaveLength(1);
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
      const isolation = policies.filter(
        (p) => p.policyname === "tenant_isolation",
      );
      expect(isolation, `${table} tenant_isolation policy`).not.toHaveLength(0);
      expect(
        isolation.some((p) => p.qual?.includes("app.tenant_id")),
        `${table} USING reads app.tenant_id`,
      ).toBe(true);
      expect(
        isolation.some((p) => p.with_check?.includes("app.tenant_id")),
        `${table} WITH CHECK reads app.tenant_id`,
      ).toBe(true);
    }
  });

  it("an unscoped app-role SELECT is fail-closed on both tables", async () => {
    const cat = await seedCatalogs(owner, tenant);
    const studyId = await insertStudy(owner, tenant, cat);
    await linkContainer(owner, tenant, studyId, cat.containerId);

    const app = await appClient();
    try {
      for (const table of TABLES) {
        const { rows } = await app.query(`SELECT id FROM "${table}"`);
        expect(rows, `${table} unscoped is empty`).toHaveLength(0);
      }
    } finally {
      await app.end();
    }
  });

  it("tenant A's scoped session never sees tenant B rows on either table", async () => {
    for (const tenantId of [isoTenantA, isoTenantB]) {
      const cat = await seedCatalogs(owner, tenantId);
      const studyId = await insertStudy(owner, tenantId, cat);
      await linkContainer(owner, tenantId, studyId, cat.containerId);
    }

    const app = await appClient();
    try {
      await app.query("BEGIN");
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [
        isoTenantA,
      ]);
      await app.query("SELECT set_config('app.role', 'admin', true)");
      for (const table of TABLES) {
        const { rows } = await app.query<{ tenantId: string }>(
          `SELECT "tenantId" FROM "${table}"`,
        );
        expect(rows.length, `${table} sees only tenant A rows`).toBeGreaterThan(0);
        expect(rows.every((r) => r.tenantId === isoTenantA)).toBe(true);
      }
      await app.query("COMMIT");
    } finally {
      await app.query("ROLLBACK").catch(() => {});
      await app.end();
    }
  });

  it("tenant A's scoped session cannot insert a tenant-B study_container row (WITH CHECK)", async () => {
    const catB = await seedCatalogs(owner, isoTenantB);
    const studyB = await insertStudy(owner, isoTenantB, catB);

    const app = await appClient();
    try {
      await app.query("BEGIN");
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [
        isoTenantA,
      ]);
      await app.query("SELECT set_config('app.role', 'admin', true)");
      await expect(
        app.query(
          `INSERT INTO "study_container" (id, "tenantId", "studyId", "containerId")
           VALUES ($1, $2, $3, $4)`,
          [`sc-${randomUUID()}`, isoTenantB, studyB, catB.containerId],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await app.query("ROLLBACK").catch(() => {});
      await app.end();
    }
  });

  it("quimia_app has full CRUD within its tenant on both tables", async () => {
    const cat = await seedCatalogs(owner, tenant);
    const secondContainerId = await addContainer(owner, tenant, "CRUD TUBE");
    const studyId = `study-${randomUUID()}`;
    const app = await appClient();
    try {
      await app.query("BEGIN");
      await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenant]);
      await app.query("SELECT set_config('app.role', 'admin', true)");

      await app.query(
        `INSERT INTO "study" (id, "tenantId", code, name, area, "sampleTypeId",
                              "methodId", "techniqueId", price, "updatedAt")
         VALUES ($1, $2, $3, 'CRUD STUDY', 'QUIMICA', $4, $5, $6, '10.00', now())`,
        [
          studyId,
          tenant,
          `CRUD-${randomUUID()}`,
          cat.sampleTypeId,
          cat.methodId,
          cat.techniqueId,
        ],
      );
      await app.query(
        `UPDATE "study" SET name = 'CRUD UPDATED' WHERE id = $1`,
        [studyId],
      );
      const { rows: studyRows } = await app.query<{ name: string }>(
        `SELECT name FROM "study" WHERE id = $1`,
        [studyId],
      );
      expect(studyRows).toEqual([{ name: "CRUD UPDATED" }]);

      const linkId = `sc-${randomUUID()}`;
      await app.query(
        `INSERT INTO "study_container" (id, "tenantId", "studyId", "containerId")
         VALUES ($1, $2, $3, $4)`,
        [linkId, tenant, studyId, cat.containerId],
      );
      await app.query(
        `UPDATE "study_container" SET "containerId" = $1 WHERE id = $2`,
        [secondContainerId, linkId],
      );
      const { rows: linkRows } = await app.query<{ containerId: string }>(
        `SELECT "containerId" FROM "study_container" WHERE id = $1`,
        [linkId],
      );
      expect(linkRows).toEqual([{ containerId: secondContainerId }]);

      await app.query(`DELETE FROM "study_container" WHERE id = $1`, [linkId]);
      await app.query(`DELETE FROM "study" WHERE id = $1`, [studyId]);
      const { rows: after } = await app.query(
        `SELECT id FROM "study" WHERE id = $1`,
        [studyId],
      );
      expect(after).toHaveLength(0);
      await app.query("COMMIT");
    } catch (err) {
      await app.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      await app.end();
    }
  });
});
