/**
 * Story 2.2 (slice 1/2) - explicit Study-Container M2M (spec R5), on a real
 * ephemeral Neon branch. Proves a study linked to two distinct containers
 * yields exactly two `study_container` rows and that a duplicate
 * `(studyId, containerId)` link is rejected.
 */
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  addContainer,
  asTenant,
  createTenant,
  insertStudy,
  linkContainer,
  seedCatalogs,
  type Catalogs,
} from "./study-fixtures";

let owner: Client;
let tenant: string;
let cat: Catalogs;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenant = await createTenant(owner, "study-m2m");
  cat = await seedCatalogs(owner, tenant);
});

afterAll(async () => {
  await owner.end();
});

describe("study_container - explicit M2M (R5)", () => {
  it("two distinct containers yield exactly two join rows", async () => {
    const secondContainerId = await addContainer(owner, tenant, "EDTA TUBE");
    const studyId = await insertStudy(owner, tenant, cat);

    await linkContainer(owner, tenant, studyId, cat.containerId);
    await linkContainer(owner, tenant, studyId, secondContainerId);

    const { rows } = await asTenant(owner, tenant, (c) =>
      c.query<{ containerId: string }>(
        `SELECT "containerId" FROM "study_container" WHERE "studyId" = $1
         ORDER BY "containerId"`,
        [studyId],
      ),
    );
    expect(rows.map((r) => r.containerId).sort()).toEqual(
      [cat.containerId, secondContainerId].sort(),
    );
  });

  it("a duplicate (studyId, containerId) link is rejected with 23505", async () => {
    const studyId = await insertStudy(owner, tenant, cat);
    await linkContainer(owner, tenant, studyId, cat.containerId);

    await expect(
      linkContainer(owner, tenant, studyId, cat.containerId),
    ).rejects.toMatchObject({ code: "23505" });
  });
});
