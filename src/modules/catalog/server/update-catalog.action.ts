/**
 * Update catalog entry (Story 2.1, change 2/6 — Phase 2). One
 * `transaction()` call updates the row AND writes the `{ENTITY}_UPDATED`
 * `AuditLog` entry with `before`/`after` snapshots atomically (AD-4/AD-10).
 * The existing row is read first (`findUnique` → `AppError NOT_FOUND` 404 if
 * absent); the update then writes the audit entry in the SAME transaction.
 *
 * Per the resolved open question in tasks.md: `updateCatalog` does NOT
 * no-op when `before` ≡ `after` — an update always writes its audit row
 * (only deactivate/reactivate carry the no-op contract). A rename colliding
 * with another row in the same tenant is caught as P2002 and translated to a
 * 409 `AppError`, exactly like create.
 */
import "server-only";
import { z } from "zod";
import {
  transaction,
  writeAuditLog,
  isUniqueConstraintViolation,
} from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import type { CurrentActorRequest } from "../../auth/server/get-current-actor";
import { CATALOGS } from "../registry";
import { catalogUpdateSchema, type UpdateCatalogInput } from "../schemas";
import { requireCatalogAdmin } from "./require-catalog-admin";

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
  const kind = CATALOGS[data.kind];

  return requireCatalogAdmin(
    request,
    async (actor) => {
      try {
        return await transaction(
          { tenantId: actor.tenantId, role: actor.role },
          async (tx) => {
            switch (data.kind) {
              case "metodos": {
                const existing = await tx.method.findUnique({
                  where: { id: data.id },
                });
                if (!existing) {
                  throw new AppError("NOT_FOUND", "Catalog entry not found.", {
                    status: 404,
                  });
                }
                const updated = await tx.method.update({
                  where: { id: data.id },
                  data: { name: data.name },
                });
                await writeAuditLog(tx, {
                  tenantId: actor.tenantId,
                  entity: kind.entity,
                  entityId: data.id,
                  action: `${kind.actionPrefix}_UPDATED`,
                  before: { name: existing.name },
                  after: { name: updated.name },
                  actorUserId: actor.userId,
                });
                return { id: data.id };
              }
              case "tecnicas": {
                const existing = await tx.technique.findUnique({
                  where: { id: data.id },
                });
                if (!existing) {
                  throw new AppError("NOT_FOUND", "Catalog entry not found.", {
                    status: 404,
                  });
                }
                const updated = await tx.technique.update({
                  where: { id: data.id },
                  data: { name: data.name },
                });
                await writeAuditLog(tx, {
                  tenantId: actor.tenantId,
                  entity: kind.entity,
                  entityId: data.id,
                  action: `${kind.actionPrefix}_UPDATED`,
                  before: { name: existing.name },
                  after: { name: updated.name },
                  actorUserId: actor.userId,
                });
                return { id: data.id };
              }
              case "equipos": {
                const existing = await tx.equipment.findUnique({
                  where: { id: data.id },
                });
                if (!existing) {
                  throw new AppError("NOT_FOUND", "Catalog entry not found.", {
                    status: 404,
                  });
                }
                const updated = await tx.equipment.update({
                  where: { id: data.id },
                  data: {
                    name: data.name,
                    model: data.model,
                    serialNumber: data.serialNumber,
                    calibrationDate: data.calibrationDate ?? null,
                  },
                });
                await writeAuditLog(tx, {
                  tenantId: actor.tenantId,
                  entity: kind.entity,
                  entityId: data.id,
                  action: `${kind.actionPrefix}_UPDATED`,
                  before: {
                    name: existing.name,
                    model: existing.model,
                    serialNumber: existing.serialNumber,
                    calibrationDate: existing.calibrationDate?.toISOString() ?? null,
                  },
                  after: {
                    name: updated.name,
                    model: updated.model,
                    serialNumber: updated.serialNumber,
                    calibrationDate: updated.calibrationDate?.toISOString() ?? null,
                  },
                  actorUserId: actor.userId,
                });
                return { id: data.id };
              }
              case "recipientes": {
                const existing = await tx.container.findUnique({
                  where: { id: data.id },
                });
                if (!existing) {
                  throw new AppError("NOT_FOUND", "Catalog entry not found.", {
                    status: 404,
                  });
                }
                const updated = await tx.container.update({
                  where: { id: data.id },
                  data: { name: data.name },
                });
                await writeAuditLog(tx, {
                  tenantId: actor.tenantId,
                  entity: kind.entity,
                  entityId: data.id,
                  action: `${kind.actionPrefix}_UPDATED`,
                  before: { name: existing.name },
                  after: { name: updated.name },
                  actorUserId: actor.userId,
                });
                return { id: data.id };
              }
              case "tipos-de-muestra": {
                const existing = await tx.sampleType.findUnique({
                  where: { id: data.id },
                });
                if (!existing) {
                  throw new AppError("NOT_FOUND", "Catalog entry not found.", {
                    status: 404,
                  });
                }
                const updated = await tx.sampleType.update({
                  where: { id: data.id },
                  data: { name: data.name },
                });
                await writeAuditLog(tx, {
                  tenantId: actor.tenantId,
                  entity: kind.entity,
                  entityId: data.id,
                  action: `${kind.actionPrefix}_UPDATED`,
                  before: { name: existing.name },
                  after: { name: updated.name },
                  actorUserId: actor.userId,
                });
                return { id: data.id };
              }
            }
          },
        );
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
    { entity: kind.entity, attemptedAction: "CATALOG_UPDATE", entityId: data.id },
  );
}