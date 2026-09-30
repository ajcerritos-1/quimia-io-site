/**
 * Create catalog entry (Story 2.1, change 2/6 — Phase 2). One
 * `transaction()` call creates the row AND writes the `{ENTITY}_CREATED`
 * `AuditLog` entry atomically (AD-4/AD-10) through the tenant-scoped
 * wrapper (AD-2/AD-3), with the `switch (kind)` calling the concrete typed
 * delegate per branch (design risk #3 mitigation — no dynamic delegate
 * access). A duplicate name within the tenant is caught as Postgres's own
 * unique-constraint violation (P2002 from `@@unique([tenantId, name])`) and
 * translated into a friendly 409 `AppError` — never a raw Prisma error.
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
                const row = await tx.method.create({
                  data: { tenantId: actor.tenantId, name: data.name },
                });
                await writeAuditLog(tx, {
                  tenantId: actor.tenantId,
                  entity: kind.entity,
                  entityId: row.id,
                  action: `${kind.actionPrefix}_CREATED`,
                  before: null,
                  after: { name: data.name },
                  actorUserId: actor.userId,
                });
                return { id: row.id };
              }
              case "tecnicas": {
                const row = await tx.technique.create({
                  data: { tenantId: actor.tenantId, name: data.name },
                });
                await writeAuditLog(tx, {
                  tenantId: actor.tenantId,
                  entity: kind.entity,
                  entityId: row.id,
                  action: `${kind.actionPrefix}_CREATED`,
                  before: null,
                  after: { name: data.name },
                  actorUserId: actor.userId,
                });
                return { id: row.id };
              }
              case "equipos": {
                const row = await tx.equipment.create({
                  data: {
                    tenantId: actor.tenantId,
                    name: data.name,
                    model: data.model,
                    serialNumber: data.serialNumber,
                    calibrationDate: data.calibrationDate ?? null,
                  },
                });
                await writeAuditLog(tx, {
                  tenantId: actor.tenantId,
                  entity: kind.entity,
                  entityId: row.id,
                  action: `${kind.actionPrefix}_CREATED`,
                  before: null,
                  after: {
                    name: data.name,
                    model: data.model,
                    serialNumber: data.serialNumber,
                    calibrationDate: row.calibrationDate?.toISOString() ?? null,
                  },
                  actorUserId: actor.userId,
                });
                return { id: row.id };
              }
              case "recipientes": {
                const row = await tx.container.create({
                  data: { tenantId: actor.tenantId, name: data.name },
                });
                await writeAuditLog(tx, {
                  tenantId: actor.tenantId,
                  entity: kind.entity,
                  entityId: row.id,
                  action: `${kind.actionPrefix}_CREATED`,
                  before: null,
                  after: { name: data.name },
                  actorUserId: actor.userId,
                });
                return { id: row.id };
              }
              case "tipos-de-muestra": {
                const row = await tx.sampleType.create({
                  data: { tenantId: actor.tenantId, name: data.name },
                });
                await writeAuditLog(tx, {
                  tenantId: actor.tenantId,
                  entity: kind.entity,
                  entityId: row.id,
                  action: `${kind.actionPrefix}_CREATED`,
                  before: null,
                  after: { name: data.name },
                  actorUserId: actor.userId,
                });
                return { id: row.id };
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
    { entity: kind.entity, attemptedAction: "CATALOG_CREATE" },
  );
}