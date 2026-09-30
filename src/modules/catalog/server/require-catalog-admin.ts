/**
 * Catalog-scoped admin guard (Story 2.1, change 2/6 — Phase 2). Thin wrapper
 * over the shared `requireRole()` guard (the SAME pattern `require-admin.ts`
 * uses for the auth module) that writes catalog-accurate denial audit rows:
 * `entity` is the catalog entity the attempt concerned (e.g. "Method") and
 * `action` is "CATALOG_ADMIN_ACTION_DENIED" — NOT `require-admin.ts`'s
 * hardcoded `entity: "User"` / `USER_ADMIN_ACTION_DENIED`, which would write
 * a misleading denial row for a catalog mutation.
 *
 * `entity` is passed by the caller (each plain action knows its kind from
 * the validated input and derives it from `CATALOGS[kind].entity`); keeping
 * it a parameter — rather than a module constant — is what makes this ONE
 * guard correct for all five catalog kinds.
 */
import "server-only";
import { UserRole } from "../../../shared/db";
import type { Actor, CurrentActorRequest } from "../../auth/server/get-current-actor";
import { requireRole } from "../../auth/server/require-role";

export type CatalogAttemptedAction =
  | "CATALOG_CREATE"
  | "CATALOG_UPDATE"
  | "CATALOG_DEACTIVATE"
  | "CATALOG_REACTIVATE";

export interface RequireCatalogAdminOptions {
  /** Which catalog entity the denied attempt concerned, e.g. "Method". */
  entity: string;
  /** What the caller was attempting when the guard ran. */
  attemptedAction: CatalogAttemptedAction;
  /** The target row id when already known from validated input (deactivate/
   *  reactivate/update); falls back to the denied actor's own id otherwise. */
  entityId?: string;
}

export async function requireCatalogAdmin<T>(
  request: CurrentActorRequest,
  fn: (actor: Actor) => Promise<T>,
  options: RequireCatalogAdminOptions,
): Promise<T> {
  return requireRole(request, [UserRole.admin], fn, {
    entity: options.entity,
    action: "CATALOG_ADMIN_ACTION_DENIED",
    attemptedAction: options.attemptedAction,
    entityId: options.entityId,
  });
}