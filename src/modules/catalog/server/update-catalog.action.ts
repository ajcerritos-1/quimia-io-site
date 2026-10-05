/**
 * Update catalog entry (Story 2.1, change 2/6). Mirrors `auth/server/
 * update-user-role.action.ts`: validate -> guard -> ONE `transaction()` that
 * finds the row (`NOT_FOUND` 404 if absent), updates it through the concrete
 * typed delegate, and writes the `{ENTITY}_UPDATED` `AuditLog` entry with
 * `before`/`after` snapshots in the SAME transaction (AD-4/AD-10). A name
 * collision with another row in the tenant is translated to a 409.
 *
 * No update no-op guard: the spec mandates no-op behavior only for
 * deactivate/reactivate, so a rename to the same value still writes an
 * honest `_UPDATED` transition (design Open Question, resolved to "no").
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
import { catalogUpdateSchema, type UpdateCatalogInput } from "../schemas";
import { requireCatalogAdmin } from "./require-catalog-admin";

const notFound = () =>
  new AppError("NOT_FOUND", "Catalog entry not found.", { status: 404 });

export async function updateCatalog(
  input: UpdateCatalogInput,
  request: CurrentActorRequest,
): Promise<{ id: string }> {
  const parsed = catalogUpdateSchema.safeParse(input);
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
              const existing = await tx.method.findUnique({ where: { id: data.id } });
              if (!existing) throw notFound();
              const row = await tx.method.update({
                where: { id: data.id },
                data: { name: data.name },
              });
              await writeAuditLog(tx, {
                tenantId,
                entity,
                entityId: row.id,
                action: `${actionPrefix}_UPDATED`,
                before: { name: existing.name },
                after: { name: row.name },
                actorUserId: actor.userId,
              });
              return { id: row.id };
            }
            case "tecnicas": {
              const existing = await tx.technique.findUnique({ where: { id: data.id } });
              if (!existing) throw notFound();
              const row = await tx.technique.update({
                where: { id: data.id },
                data: { name: data.name },
              });
              await writeAuditLog(tx, {
                tenantId,
                entity,
                entityId: row.id,
                action: `${actionPrefix}_UPDATED`,
                before: { name: existing.name },
                after: { name: row.name },
                actorUserId: actor.userId,
              });
              return { id: row.id };
            }
            case "equipos": {
              const existing = await tx.equipment.findUnique({ where: { id: data.id } });
              if (!existing) throw notFound();
              const row = await tx.equipment.update({
                where: { id: data.id },
                data: {
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
                action: `${actionPrefix}_UPDATED`,
                before: {
                  name: existing.name,
                  model: existing.model,
                  serialNumber: existing.serialNumber,
                  calibrationDate: existing.calibrationDate?.toISOString() ?? null,
                },
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
              const existing = await tx.container.findUnique({ where: { id: data.id } });
              if (!existing) throw notFound();
              const row = await tx.container.update({
                where: { id: data.id },
                data: { name: data.name },
              });
              await writeAuditLog(tx, {
                tenantId,
                entity,
                entityId: row.id,
                action: `${actionPrefix}_UPDATED`,
                before: { name: existing.name },
                after: { name: row.name },
                actorUserId: actor.userId,
              });
              return { id: row.id };
            }
            case "tipos-de-muestra": {
              const existing = await tx.sampleType.findUnique({ where: { id: data.id } });
              if (!existing) throw notFound();
              const row = await tx.sampleType.update({
                where: { id: data.id },
                data: { name: data.name },
              });
              await writeAuditLog(tx, {
                tenantId,
                entity,
                entityId: row.id,
                action: `${actionPrefix}_UPDATED`,
                before: { name: existing.name },
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
    { entity, attemptedAction: "CATALOG_UPDATE", entityId: data.id },
  );
}
