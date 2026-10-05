/**
 * Create catalog entry (Story 2.1, change 2/6). Mirrors `auth/server/
 * create-user.action.ts`'s shape: validate -> guard -> ONE `transaction()`
 * that inserts the row and writes the `{ENTITY}_CREATED` `AuditLog` entry in
 * the SAME transaction (AD-4/AD-10), then translate a duplicate name into a
 * friendly 409. Reads/writes go through `transaction()` (AD-3), never a raw
 * `prisma.<model>` call.
 *
 * The `switch (kind)` calls the concrete typed delegate per branch
 * (`tx.method`, `tx.equipment`, ...) — never `scoped()[kind]` dynamic access
 * (type-unsafe; design decision). The registry's `entity`/`actionPrefix` are
 * the single source of the audit metadata; they are read once from the
 * validated kind and reused across branches.
 */
import "server-only";
import { z } from "zod";
import {
  isUniqueConstraintViolation,
  transaction,
  writeAuditLog,
} from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import type { CurrentActorRequest } from "../../auth/server/get-current-actor";
import { CATALOGS } from "../registry";
import { catalogCreateSchema, type CreateCatalogInput } from "../schemas";
import { requireCatalogAdmin } from "./require-catalog-admin";

export async function createCatalog(
  input: CreateCatalogInput,
  request: CurrentActorRequest,
): Promise<{ id: string }> {
  const parsed = catalogCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid input.", {
      status: 400,
      details: z.flattenError(parsed.error),
    });
  }
  const data = parsed.data;
  const { entity, actionPrefix } = CATALOGS[data.kind];

  return requireCatalogAdmin(
    request,
    async (actor) => {
      const tenantId = actor.tenantId;
      try {
        return await transaction({ tenantId, role: actor.role }, async (tx) => {
          switch (data.kind) {
            case "metodos": {
              const row = await tx.method.create({ data: { tenantId, name: data.name } });
              await writeAuditLog(tx, {
                tenantId,
                entity,
                entityId: row.id,
                action: `${actionPrefix}_CREATED`,
                before: null,
                after: { name: row.name },
                actorUserId: actor.userId,
              });
              return { id: row.id };
            }
            case "tecnicas": {
              const row = await tx.technique.create({ data: { tenantId, name: data.name } });
              await writeAuditLog(tx, {
                tenantId,
                entity,
                entityId: row.id,
                action: `${actionPrefix}_CREATED`,
                before: null,
                after: { name: row.name },
                actorUserId: actor.userId,
              });
              return { id: row.id };
            }
            case "equipos": {
              const row = await tx.equipment.create({
                data: {
                  tenantId,
                  name: data.name,
                  model: data.model,
                  serialNumber: data.serialNumber,
                  calibrationDate: data.calibrationDate ?? null,
                },
              });
              await writeAuditLog(tx, {
                tenantId,
                entity,
                entityId: row.id,
                action: `${actionPrefix}_CREATED`,
                before: null,
                after: {
                  name: row.name,
                  model: row.model,
                  serialNumber: row.serialNumber,
                  calibrationDate: row.calibrationDate?.toISOString() ?? null,
                },
                actorUserId: actor.userId,
              });
              return { id: row.id };
            }
            case "recipientes": {
              const row = await tx.container.create({ data: { tenantId, name: data.name } });
              await writeAuditLog(tx, {
                tenantId,
                entity,
                entityId: row.id,
                action: `${actionPrefix}_CREATED`,
                before: null,
                after: { name: row.name },
                actorUserId: actor.userId,
              });
              return { id: row.id };
            }
            case "tipos-de-muestra": {
              const row = await tx.sampleType.create({ data: { tenantId, name: data.name } });
              await writeAuditLog(tx, {
                tenantId,
                entity,
                entityId: row.id,
                action: `${actionPrefix}_CREATED`,
                before: null,
                after: { name: row.name },
                actorUserId: actor.userId,
              });
              return { id: row.id };
            }
          }
        });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          throw new AppError(
            "NAME_IN_USE",
            "A catalog entry with this name already exists.",
            { status: 409, cause: error },
          );
        }
        throw error;
      }
    },
    { entity, attemptedAction: "CATALOG_CREATE" },
  );
}
