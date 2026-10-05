/**
 * Deactivate catalog entry (Story 2.1, change 2/6) — the deactivate-not-delete
 * lifecycle (design locked decision #3). Mirrors `auth/server/
 * deactivate-user.action.ts`: validate -> guard -> ONE `transaction()` that
 * finds the row (`NOT_FOUND` 404 if absent), and — when it is currently active
 * — flips `isActive` to `false` and writes the `{ENTITY}_DEACTIVATED`
 * `AuditLog` entry in the SAME transaction (AD-4/AD-10). The row is never
 * deleted.
 *
 * No-op guard: deactivating an already-inactive row returns the existing id
 * WITHOUT a mutation or audit write — no misleading `before == after`
 * transition (spec "Deactivating an inactive row is a no-op").
 */
import "server-only";
import { z } from "zod";
import { transaction, writeAuditLog } from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import type { CurrentActorRequest } from "../../auth/server/get-current-actor";
import { CATALOGS } from "../registry";
import { catalogIdSchema, type CatalogIdInput } from "../schemas";
import { requireCatalogAdmin } from "./require-catalog-admin";

const notFound = () =>
  new AppError("NOT_FOUND", "Catalog entry not found.", { status: 404 });

export async function deactivateCatalog(
  input: CatalogIdInput,
  request: CurrentActorRequest,
): Promise<{ id: string }> {
  const parsed = catalogIdSchema.safeParse(input);
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
      return transaction({ tenantId, role: actor.role }, async (tx) => {
        switch (data.kind) {
          case "metodos": {
            const existing = await tx.method.findUnique({ where: { id: data.id } });
            if (!existing) throw notFound();
            if (!existing.isActive) return { id: data.id };
            const row = await tx.method.update({
              where: { id: data.id },
              data: { isActive: false },
            });
            await writeAuditLog(tx, {
              tenantId,
              entity,
              entityId: row.id,
              action: `${actionPrefix}_DEACTIVATED`,
              before: { isActive: existing.isActive },
              after: { isActive: false },
              actorUserId: actor.userId,
            });
            return { id: row.id };
          }
          case "tecnicas": {
            const existing = await tx.technique.findUnique({ where: { id: data.id } });
            if (!existing) throw notFound();
            if (!existing.isActive) return { id: data.id };
            const row = await tx.technique.update({
              where: { id: data.id },
              data: { isActive: false },
            });
            await writeAuditLog(tx, {
              tenantId,
              entity,
              entityId: row.id,
              action: `${actionPrefix}_DEACTIVATED`,
              before: { isActive: existing.isActive },
              after: { isActive: false },
              actorUserId: actor.userId,
            });
            return { id: row.id };
          }
          case "equipos": {
            const existing = await tx.equipment.findUnique({ where: { id: data.id } });
            if (!existing) throw notFound();
            if (!existing.isActive) return { id: data.id };
            const row = await tx.equipment.update({
              where: { id: data.id },
              data: { isActive: false },
            });
            await writeAuditLog(tx, {
              tenantId,
              entity,
              entityId: row.id,
              action: `${actionPrefix}_DEACTIVATED`,
              before: { isActive: existing.isActive },
              after: { isActive: false },
              actorUserId: actor.userId,
            });
            return { id: row.id };
          }
          case "recipientes": {
            const existing = await tx.container.findUnique({ where: { id: data.id } });
            if (!existing) throw notFound();
            if (!existing.isActive) return { id: data.id };
            const row = await tx.container.update({
              where: { id: data.id },
              data: { isActive: false },
            });
            await writeAuditLog(tx, {
              tenantId,
              entity,
              entityId: row.id,
              action: `${actionPrefix}_DEACTIVATED`,
              before: { isActive: existing.isActive },
              after: { isActive: false },
              actorUserId: actor.userId,
            });
            return { id: row.id };
          }
          case "tipos-de-muestra": {
            const existing = await tx.sampleType.findUnique({ where: { id: data.id } });
            if (!existing) throw notFound();
            if (!existing.isActive) return { id: data.id };
            const row = await tx.sampleType.update({
              where: { id: data.id },
              data: { isActive: false },
            });
            await writeAuditLog(tx, {
              tenantId,
              entity,
              entityId: row.id,
              action: `${actionPrefix}_DEACTIVATED`,
              before: { isActive: existing.isActive },
              after: { isActive: false },
              actorUserId: actor.userId,
            });
            return { id: row.id };
          }
        }
      });
    },
    { entity, attemptedAction: "CATALOG_DEACTIVATE", entityId: data.id },
  );
}
