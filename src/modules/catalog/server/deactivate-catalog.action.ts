/**
 * Deactivate catalog entry (Story 2.1, change 2/6 — Phase 2). Flips
 * `isActive` to `false` — never a hard delete (locked decision #3) — and
 * writes the `{ENTITY}_DEACTIVATED` `AuditLog` entry atomically in the same
 * `transaction()` (AD-4/AD-10). Deactivating an already-inactive row is a
 * NO-OP: it returns `{ id }` and skips BOTH the mutation and the audit write
 * (spec: "no change occurs and no audit entry is written").
 */
import "server-only";
import { z } from "zod";
import { transaction, writeAuditLog } from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import type { CurrentActorRequest } from "../../auth/server/get-current-actor";
import { CATALOGS } from "../registry";
import { requireCatalogAdmin } from "./require-catalog-admin";

export const catalogIdSchema = z.object({
  kind: z.enum([
    "metodos",
    "tecnicas",
    "equipos",
    "recipientes",
    "tipos-de-muestra",
  ]),
  id: z.string().min(1),
});

export type CatalogIdInput = z.input<typeof catalogIdSchema>;

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
            if (!existing.isActive) return { id: data.id };
            await tx.method.update({
              where: { id: data.id },
              data: { isActive: false },
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
            if (!existing.isActive) return { id: data.id };
            await tx.technique.update({
              where: { id: data.id },
              data: { isActive: false },
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
            if (!existing.isActive) return { id: data.id };
            await tx.equipment.update({
              where: { id: data.id },
              data: { isActive: false },
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
            if (!existing.isActive) return { id: data.id };
            await tx.container.update({
              where: { id: data.id },
              data: { isActive: false },
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
            if (!existing.isActive) return { id: data.id };
            await tx.sampleType.update({
              where: { id: data.id },
              data: { isActive: false },
            });
            break;
          }
        }

        await writeAuditLog(tx, {
          tenantId: actor.tenantId,
          entity: kind.entity,
          entityId: data.id,
          action: `${kind.actionPrefix}_DEACTIVATED`,
          before: { isActive: true },
          after: { isActive: false },
          actorUserId: actor.userId,
        });
        return { id: data.id };
      }),
    { entity: kind.entity, attemptedAction: "CATALOG_DEACTIVATE", entityId: data.id },
  );
}