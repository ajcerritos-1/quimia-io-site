/**
 * Story 2.2 (slice 1/2) - Study FK integrity (spec R2, R3, R5), on a real
 * ephemeral Neon branch. Proves FK resolution against all five catalogs,
 * rejection of a missing catalog row, composite tenant-scoped FK rejection
 * (a plain single-column FK would accept the cross-tenant reference because
 * PostgreSQL RI checks bypass RLS), ON DELETE RESTRICT, and that a
 * deactivated catalog row stays referenceable.
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  asTenant,
  createTenant,
  insertStudy,
  linkContainer,
  seedCatalogs,
  type Catalogs,
} from "./study-fixtures";

let owner: Client;
let tenantA: string;
let tenantB: string;
let catA: Catalogs;
let catB: Catalogs;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantA = await createTenant(owner, "study-fk-a");
  tenantB = await createTenant(owner, "study-fk-b");
  catA = await seedCatalogs(owner, tenantA);
  catB = await seedCatalogs(owner, tenantB);
});

afterAll(async () => {
  await owner.end();
});

describe("study_fk - resolution (R2)", () => {
  it("a study referencing all five catalogs resolves each one", async () => {
    const studyId = await insertStudy(owner, tenantA, catA);
    await linkContainer(owner, tenantA, studyId, catA.containerId);

    const { rows } = await asTenant(owner, tenantA, (c) =>
      c.query(
        `SELECT st.name AS "sampleType", m.name AS method, t.name AS technique,
                e.name AS equipment, ct.name AS container
         FROM "study" s
         JOIN "sample_type" st ON st.id = s."sampleTypeId" AND st."tenantId" = s."tenantId"
         JOIN "method" m ON m.id = s."methodId" AND m."tenantId" = s."tenantId"
         JOIN "technique" t ON t.id = s."techniqueId" AND t."tenantId" = s."tenantId"
         JOIN "equipment" e ON e.id = s."equipmentId" AND e."tenantId" = s."tenantId"
         JOIN "study_container" sc ON sc."studyId" = s.id AND sc."tenantId" = s."tenantId"
         JOIN "container" ct ON ct.id = sc."containerId" AND ct."tenantId" = s."tenantId"
         WHERE s.id = $1`,
        [studyId],
      ),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].method).toContain("METHOD");
    expect(rows[0].sampleType).toContain("SAMPLE");
    expect(rows[0].technique).toContain("TECHNIQUE");
    expect(rows[0].equipment).toContain("EQUIPMENT");
    expect(rows[0].container).toContain("CONTAINER");
  });

  it("a methodId pointing at a non-existent row is rejected with 23503", async () => {
    await expect(
      insertStudy(owner, tenantA, catA, { methodId: `mt-missing-${randomUUID()}` }),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("a deactivated catalog row remains referenceable", async () => {
    const methodId = `mt-inactive-${randomUUID()}`;
    await asTenant(owner, tenantA, (c) =>
      c.query(
        `INSERT INTO "method" (id, "tenantId", name, "isActive", "updatedAt")
         VALUES ($1, $2, $3, false, now())`,
        [methodId, tenantA, `INACTIVE METHOD ${randomUUID()}`],
      ),
    );
    await expect(
      insertStudy(owner, tenantA, catA, { methodId }),
    ).resolves.toEqual(expect.any(String));
  });
});

describe("study_fk - composite cross-tenant rejection (R2, R5)", () => {
  it("tenant A's study cannot reference tenant B's Method (23503)", async () => {
    await expect(
      insertStudy(owner, tenantA, catA, { methodId: catB.methodId }),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("tenant A's study_container cannot link tenant B's Container (23503)", async () => {
    const studyId = await insertStudy(owner, tenantA, catA);
    await expect(
      linkContainer(owner, tenantA, studyId, catB.containerId),
    ).rejects.toMatchObject({ code: "23503" });
  });
});

describe("study_fk - ON DELETE RESTRICT (R3)", () => {
  it("deleting a Method referenced by a Study is refused with 23001", async () => {
    const methodId = `mt-referenced-${randomUUID()}`;
    await asTenant(owner, tenantA, (c) =>
      c.query(
        `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
        [methodId, tenantA, `REFERENCED METHOD ${randomUUID()}`],
      ),
    );
    const studyId = await insertStudy(owner, tenantA, catA, { methodId });

    // ON DELETE RESTRICT raises SQLSTATE 23001 (restrict_violation), not
    // 23503: PostgreSQL defers NO ACTION to statement end, while RESTRICT
    // fails immediately. Both mean the delete was refused.
    await expect(
      asTenant(owner, tenantA, (c) =>
        c.query(`DELETE FROM "method" WHERE id = $1`, [methodId]),
      ),
    ).rejects.toMatchObject({ code: "23001" });

    const { rows } = await asTenant(owner, tenantA, (c) =>
      c.query(`SELECT id FROM "method" WHERE id = $1`, [methodId]),
    );
    expect(rows).toHaveLength(1);
    const { rows: studyRows } = await asTenant(owner, tenantA, (c) =>
      c.query(`SELECT id FROM "study" WHERE id = $1`, [studyId]),
    );
    expect(studyRows).toHaveLength(1);
  });

  it("deleting a Container referenced by a Study is refused with 23001 and keeps the link", async () => {
    const studyId = await insertStudy(owner, tenantA, catA);
    await linkContainer(owner, tenantA, studyId, catA.containerId);

    await expect(
      asTenant(owner, tenantA, (c) =>
        c.query(`DELETE FROM "container" WHERE id = $1`, [catA.containerId]),
      ),
    ).rejects.toMatchObject({ code: "23001" });

    const { rows } = await asTenant(owner, tenantA, (c) =>
      c.query(
        `SELECT "studyId", "containerId" FROM "study_container"
         WHERE "studyId" = $1 AND "containerId" = $2`,
        [studyId, catA.containerId],
      ),
    );
    expect(rows).toEqual([{ studyId, containerId: catA.containerId }]);
  });
});
