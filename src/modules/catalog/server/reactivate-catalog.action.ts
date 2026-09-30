/**
 * Reactivate catalog entry (Story 2.1, change 2/6 — Phase 2). Mirror of
 * `deactivateCatalog`: flips `isActive` back to `true` and writes the
 * `{ENTITY}_REACTIVATED` `AuditLog` entry atomically in the same
 * `transaction()` (AD-4/AD-10). Reactivating an already-active row is a
 * NO-OP: it returns `{ id }` and skips BOTH the mutation and the audit write.
 */
import "server-only";
import { z } from "zod";
import { transaction, writeAuditLog } from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import type { CurrentActorRequest } from "../../auth/server/get-current-actor";
import { CATALOGS } from "../registry";
import { requireCatalogAdmin } from "./require-catalog-admin";
import { catalogIdSchema, type CatalogIdInput } from "./deactivate-catalog.action";

export async function reactivateCatalog(
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
  const kind = CATALOGS[data.kind];

  return requireCatalogAdmin(
    request,
    async (actor) =>
      transaction({ tenantId: actor.tenantId, role: actor.role }, async (tx) => {
        switch (data.kind) {
          case "metodos": {
            const existing = await tx.method.findUnique({ where: { id: data.id } });
            if (!existing) {
              throw new AppError("NOT_FOUND", "Catalog entry not found.", {
                status: 404,
              });
            }
            if (existing.isActive) return { id: data.id };
            await tx.method.update({
              where: { id: data.id },
              data: { isActive: true },
            });
            break;
          }
          case "tecnicas": {
            const existing = await tx.technique.findUnique({ where: { id: data.id } });
            if (!existing) {
              throw new AppError("NOT_FOUND", "Catalog entry not found.", {
                status: 404,
              });
            }
            if (existing.isActive) return { id: data.id };
            await tx.technique.update({
              where: { id: data.id },
              data: { isActive: true },
            });
            break;
          }
          case "equipos": {
            const existing = await tx.equipment.findUnique({ where: { id: data.id } });
            if (!existing) {
              throw new AppError("NOT_FOUND", "Catalog entry not found.", {
                status: 404,
              });
            }
            if (existing.isActive) return { id: data.id };
            await tx.equipment.update({
              where: { id: data.id },
              data: { isActive: true },
            });
            break;
          }
          case "recipientes": {
            const existing = await tx.container.findUnique({ where: { id: data.id } });
            if (!existing) {
              throw new AppError("NOT_FOUND", "Catalog entry not found.", {
                status: 404,
              });
            }
            if (existing.isActive) return { id: data.id };
            await tx.container.update({
              where: { id: data.id },
              data: { isActive: true },
            });
            break;
          }
          case "tipos-de-muestra": {
            const existing = await tx.sampleType.findUnique({ where: { id: data.id } });
            if (!existing) {
              throw new AppError("NOT_FOUND", "Catalog entry not found.", {
                status: 404,
              });
            }
            if (existing.isActive) return { id: data.id };
            await tx.sampleType.update({
              where: { id: data.id },
              data: { isActive: true },
            });
            break;
          }
        }

        await writeAuditLog(tx, {
          tenantId: actor.tenantId,
          entity: kind.entity,
          entityId: data.id,
          action: `${kind.actionPrefix}_REACTIVATED`,
          before: { isActive: false },
          after: { isActive: true },
          actorUserId: actor.userId,
        });
        return { id: data.id };
      }),
    { entity: kind.entity, attemptedAction: "CATALOG_REACTIVATE", entityId: data.id },
  );
}