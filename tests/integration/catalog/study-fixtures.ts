import { randomUUID } from "node:crypto";
import type { Client } from "pg";

export interface Catalogs {
  sampleTypeId: string;
  methodId: string;
  techniqueId: string;
  equipmentId: string;
  containerId: string;
}

export async function asTenant<T>(
  client: Client,
  tenantId: string,
  fn: (c: Client) => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function createTenant(
  client: Client,
  label: string,
): Promise<string> {
  const id = `tenant-${label}-${randomUUID()}`;
  await client.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [id, `lab-${label}-${randomUUID()}`, `Study ${label} Lab`],
  );
  return id;
}

export async function seedCatalogs(
  client: Client,
  tenantId: string,
): Promise<Catalogs> {
  const s = randomUUID();
  const ids: Catalogs = {
    sampleTypeId: `st-${s}`,
    methodId: `mt-${s}`,
    techniqueId: `tq-${s}`,
    equipmentId: `eq-${s}`,
    containerId: `ct-${s}`,
  };
  await asTenant(client, tenantId, async (c) => {
    await c.query(
      `INSERT INTO "sample_type" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [ids.sampleTypeId, tenantId, `SAMPLE ${s}`],
    );
    await c.query(
      `INSERT INTO "method" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [ids.methodId, tenantId, `METHOD ${s}`],
    );
    await c.query(
      `INSERT INTO "technique" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [ids.techniqueId, tenantId, `TECHNIQUE ${s}`],
    );
    await c.query(
      `INSERT INTO "equipment" (id, "tenantId", name, model, "serialNumber", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now())`,
      [ids.equipmentId, tenantId, `EQUIPMENT ${s}`, "Z206A", `SN-${s}`],
    );
    await c.query(
      `INSERT INTO "container" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [ids.containerId, tenantId, `CONTAINER ${s}`],
    );
  });
  return ids;
}

export async function insertStudy(
  client: Client,
  tenantId: string,
  cat: Catalogs,
  overrides: {
    code?: string;
    name?: string;
    methodId?: string;
    equipmentId?: string | null;
  } = {},
): Promise<string> {
  const id = `study-${randomUUID()}`;
  const equipmentId =
    overrides.equipmentId === undefined
      ? cat.equipmentId
      : overrides.equipmentId;
  await asTenant(client, tenantId, (c) =>
    c.query(
      `INSERT INTO "study" (id, "tenantId", code, name, area, "sampleTypeId",
                            "methodId", "techniqueId", "equipmentId", price, "updatedAt")
       VALUES ($1, $2, $3, $4, 'QUIMICA', $5, $6, $7, $8, '100.00', now())`,
      [
        id,
        tenantId,
        overrides.code ?? `C-${randomUUID()}`,
        overrides.name ?? "STUDY FIXTURE",
        cat.sampleTypeId,
        overrides.methodId ?? cat.methodId,
        cat.techniqueId,
        equipmentId,
      ],
    ),
  );
  return id;
}

export async function addContainer(
  client: Client,
  tenantId: string,
  name = "CONTAINER EXTRA",
): Promise<string> {
  const id = `ct-${randomUUID()}`;
  await asTenant(client, tenantId, (c) =>
    c.query(
      `INSERT INTO "container" (id, "tenantId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      [id, tenantId, `${name} ${randomUUID()}`],
    ),
  );
  return id;
}

export async function linkContainer(
  client: Client,
  tenantId: string,
  studyId: string,
  containerId: string,
): Promise<string> {
  const id = `sc-${randomUUID()}`;
  await asTenant(client, tenantId, (c) =>
    c.query(
      `INSERT INTO "study_container" (id, "tenantId", "studyId", "containerId")
       VALUES ($1, $2, $3, $4)`,
      [id, tenantId, studyId, containerId],
    ),
  );
  return id;
}
