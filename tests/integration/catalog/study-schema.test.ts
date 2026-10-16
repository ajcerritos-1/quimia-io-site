/**
 * Story 2.2 (Slice 1/2) — `study_schema` contract (study-catalog R1, R4, R5,
 * R7, R10). Proves, on a real ephemeral Neon branch with no mocks, that the
 * `study` and `study_container` tables exist with the exact spec column sets
 * and required/nullable split; that `(tenantId, code)` uniqueness is per
 * tenant; that `name` is not unique; that `price` keeps `Decimal(10,2)`
 * fidelity; that the R1 defaults apply; that `equipmentId` and
 * `patientConditions` accept NULL; that ids are cuid2 via `scoped()`; that the
 * join is the explicit `study_container` table (no implicit join table); and
 * that the migration seeds no rows.
 *
 * Fixtures for catalogs are seeded through the owner role inside a transaction
 * that sets `app.tenant_id`, because FORCE RLS applies to the owner as well.
 */
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

const STUDY_COLUMNS = [
  "id",
  "tenantId",
  "code",
  "name",
  "area",
  "sampleTypeId",
  "methodId",
  "techniqueId",
  "equipmentId",
  "patientConditions",
  "processDays",
  "price",
  "tax",
  "printMethod",
  "printTechnique",
  "printEquipment",
  "printSample",
  "isActive",
  "createdAt",
  "updatedAt",
];
const STUDY_CONTAINER_COLUMNS = ["id", "tenantId", "studyId", "containerId"];
const NULLABLE_STUDY_COLUMNS = ["equipmentId", "patientConditions"];

interface Catalogs {
  sampleTypeId: string;
  methodId: string;
  techniqueId: string;
  equipmentId: string;
  containerId: string;
}

let owner: Client;
let tenantA: string;
let tenantB: string;

beforeAll(async () => {
  owner = new Client({ connectionString: inject("ownerDatabaseUrl") });
  await owner.connect();
  tenantA = `tenant-study-schema-a-${randomUUID()}`;
  tenantB = `tenant-study-schema-b-${randomUUID()}`;
  for (const [id, label] of [
    [tenantA, "a"],
    [tenantB, "b"],
  ] as const) {
    await owner.query(
      `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [id, `lab-study-schema-${label}-${randomUUID()}`, `Study Schema Lab ${label}`],
    );
  }
});

afterAll(async () => {
  await owner.end();
});

/** Runs `fn` on the owner connection inside a transaction scoped to `tenantId`. */
async function asTenant<T>(tenantId: string, fn: (c: Client) => Promise<T>): Promise<T> {
  await owner.query("BEGIN");
  try {
    await owner.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn(owner);
    await owner.query("COMMIT");
    return result;
  } catch (err) {
    await owner.query("ROLLBACK");
    throw err;
  }
}

/** Seeds one row in each of the five Story 2.1 catalogs for `tenantId`. */
async function seedCatalogs(tenantId: string): Promise<Catalogs> {
  const suffix = randomUUID();
  const ids: Catalogs = {
    sampleTypeId: `st-${suffix}`,
    methodId: `mt-${suffix}`,
    techniqueId: `tq-${suffix}`,
    equipmentId: `eq-${suffix}`,
    containerId: `ct-${suffix}`,
  };
  await asTenant(tenantId, async (c) => {
    await c.query(
      `INSERT INTO "sample_type" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [ids.sampleTypeId, tenantId, `SAMPLE ${suffix}`],
    );
    await c.query(
      `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [ids.methodId, tenantId, `METHOD ${suffix}`],
    );
    await c.query(
      `INSERT INTO "technique" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [ids.techniqueId, tenantId, `TECHNIQUE ${suffix}`],
    );
    await c.query(
      `INSERT INTO "equipment" (id, "tenantId", name, model, "serialNumber", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now())`,
      [ids.equipmentId, tenantId, `EQUIPMENT ${suffix}`, "Z206A", `SN-${suffix}`],
    );
    await c.query(
      `INSERT INTO "container" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [ids.containerId, tenantId, `CONTAINER ${suffix}`],
    );
  });
  return ids;
}

/** Inserts a study with only the required columns, so R1 defaults come from the DB. */
async function insertStudy(
  tenantId: string,
  cat: Catalogs,
  fields: { code: string; name?: string; price?: string; equipmentId?: string | null },
): Promise<string> {
  const id = `study-${randomUUID()}`;
  const equipmentId = fields.equipmentId === undefined ? cat.equipmentId : fields.equipmentId;
  await asTenant(tenantId, (c) =>
    c.query(
      `INSERT INTO "study" (id, "tenantId", code, name, area, "sampleTypeId", "methodId",
                            "techniqueId", "equipmentId", price, "updatedAt")
       VALUES ($1, $2, $3, $4, 'QUIMICA', $5, $6, $7, $8, $9, now())`,
      [
        id,
        tenantId,
        fields.code,
        fields.name ?? `STUDY ${fields.code}`,
        cat.sampleTypeId,
        cat.methodId,
        cat.techniqueId,
        equipmentId,
        fields.price ?? "100.00",
      ],
    ),
  );
  return id;
}

async function columnsOf(table: string): Promise<Array<{ name: string; nullable: boolean }>> {
  const { rows } = await owner.query<{ column_name: string; is_nullable: string }>(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  return rows.map((r) => ({ name: r.column_name, nullable: r.is_nullable === "YES" }));
}

describe("study_schema — structure (R1, R5)", () => {
  it("study has exactly the 20 spec R1 columns, in contract order", async () => {
    const cols = await columnsOf("study");
    expect(cols.map((c) => c.name)).toEqual([...STUDY_COLUMNS]);
  });

  it("the required/nullable split matches spec R1 (equipmentId and patientConditions nullable)", async () => {
    const cols = await columnsOf("study");
    const nullable = cols.filter((c) => c.nullable).map((c) => c.name);
    expect(nullable).toEqual([...NULLABLE_STUDY_COLUMNS]);
  });

  it("study_container has exactly id, tenantId, studyId, containerId", async () => {
    const cols = await columnsOf("study_container");
    expect(cols.map((c) => c.name)).toEqual([...STUDY_CONTAINER_COLUMNS]);
  });

  it("the join is the explicit study_container table and no implicit _StudyToContainer exists (R5)", async () => {
    const { rows } = await owner.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('study_container', '_StudyToContainer')
       ORDER BY table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(["study_container"]);
  });
});

describe("study_schema — uniqueness and money (R1, R4)", () => {
  it("a duplicate (tenantId, code) within one tenant is rejected with 23505", async () => {
    const cat = await seedCatalogs(tenantA);
    const code = `QS6-${randomUUID()}`;
    await insertStudy(tenantA, cat, { code });
    await expect(
      insertStudy(tenantA, cat, { code, name: "A DIFFERENT NAME" }),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("the same code in another tenant is allowed (AD-8 per-tenant uniqueness)", async () => {
    const code = `QS6-${randomUUID()}`;
    const catA = await seedCatalogs(tenantA);
    const catB = await seedCatalogs(tenantB);
    const idA = await insertStudy(tenantA, catA, { code });
    const idB = await insertStudy(tenantB, catB, { code });
    expect(idA).not.toBe(idB);
  });

  it("a duplicate name with a different code is allowed (name is not unique, D7)", async () => {
    const cat = await seedCatalogs(tenantA);
    const name = `PERFIL LIPIDICO ${randomUUID()}`;
    await insertStudy(tenantA, cat, { code: `LIP-${randomUUID()}`, name });
    await expect(
      insertStudy(tenantA, cat, { code: `LIP-${randomUUID()}`, name }),
    ).resolves.toEqual(expect.any(String));
  });

  it("price 1234.56 round-trips with Decimal(10,2) fidelity (NFR-9)", async () => {
    const cat = await seedCatalogs(tenantA);
    const id = await insertStudy(tenantA, cat, { code: `PRC-${randomUUID()}`, price: "1234.56" });
    const { rows } = await asTenant(tenantA, (c) =>
      c.query<{ price: string }>(`SELECT price::text AS price FROM "study" WHERE id = $1`, [id]),
    );
    expect(rows[0].price).toBe("1234.56");
  });
});

describe("study_schema — defaults and identity (R1, R7, R10)", () => {
  it("processDays=1, isActive=true, tax=false, and the four print flags=false on insert", async () => {
    const cat = await seedCatalogs(tenantA);
    const id = await insertStudy(tenantA, cat, { code: `DEF-${randomUUID()}` });
    const { rows } = await asTenant(tenantA, (c) =>
      c.query(
        `SELECT "processDays", "isActive", tax, "printMethod", "printTechnique",
                "printEquipment", "printSample"
         FROM "study" WHERE id = $1`,
        [id],
      ),
    );
    expect(rows[0]).toEqual({
      processDays: 1,
      isActive: true,
      tax: false,
      printMethod: false,
      printTechnique: false,
      printEquipment: false,
      printSample: false,
    });
  });

  it("equipmentId NULL and patientConditions NULL are accepted (D8)", async () => {
    const cat = await seedCatalogs(tenantA);
    const id = await insertStudy(tenantA, cat, { code: `NUL-${randomUUID()}`, equipmentId: null });
    const { rows } = await asTenant(tenantA, (c) =>
      c.query(`SELECT "equipmentId", "patientConditions" FROM "study" WHERE id = $1`, [id]),
    );
    expect(rows[0]).toEqual({ equipmentId: null, patientConditions: null });
  });

  it("ids are cuid2 and unique per row, created through scoped() (R7)", async () => {
    // Only this case goes through the real Prisma wrapper: cuid2 is generated
    // client-side (the DB column has no default), so raw SQL cannot prove it.
    const { scoped } = await import("../../../src/shared/db");
    const cat = await seedCatalogs(tenantA);
    const db = scoped({ tenantId: tenantA, role: "admin" });
    const first = await db.study.create({
      data: {
        tenantId: tenantA,
        code: `CUID-${randomUUID()}`,
        name: "CUID STUDY ONE",
        area: "QUIMICA",
        sampleTypeId: cat.sampleTypeId,
        methodId: cat.methodId,
        techniqueId: cat.techniqueId,
        price: "10.00",
      },
    });
    const second = await db.study.create({
      data: {
        tenantId: tenantA,
        code: `CUID-${randomUUID()}`,
        name: "CUID STUDY TWO",
        area: "QUIMICA",
        sampleTypeId: cat.sampleTypeId,
        methodId: cat.methodId,
        techniqueId: cat.techniqueId,
        price: "10.00",
      },
    });
    expect(first.id).not.toBe(second.id);
    for (const id of [first.id, second.id]) {
      expect(id).toMatch(/^[a-z0-9]{24}$/);
    }
  });

  it("the study migration contains no INSERT or COPY statements (R10 static check)", () => {
    const migrationsDir = join(process.cwd(), "prisma", "migrations");
    const migrationDir = readdirSync(migrationsDir).find((d) => d.endsWith("_study"));
    expect(migrationDir, "the _study migration exists").toBeDefined();
    const sql = readFileSync(join(migrationsDir, migrationDir!, "migration.sql"), "utf8");
    expect(sql).not.toMatch(/INSERT\s+INTO/i);
    expect(sql).not.toMatch(/^\s*COPY\b/im);
  });
});
