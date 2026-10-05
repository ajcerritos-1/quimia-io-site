/**
 * Catalog-scoped admin guard (Story 2.1, change 2/6). A thin wrapper over the
 * shared `requireRole()` guard — the exact same pattern `auth/server/
 * require-admin.ts` uses for the User entity. It exists as its own module
 * because `require-admin.ts` hardcodes `entity: "User"` and `action:
 * "USER_ADMIN_ACTION_DENIED"`, which would write a misleading denial row for
 * a catalog mutation. This guard records the real catalog `entity` and the
 * `CATALOG_ADMIN_ACTION_DENIED` action instead, while keeping the single
 * role-check path (`requireRole` -> `roles.ts`'s `isRoleAllowed`, AD-1) and
 * the single denial-audit write path (AD-10).
 */
import "server-only";
import { UserRole } from "../../../shared/db";
import type {
  Actor,
  CurrentActorRequest,
} from "../../auth/server/get-current-actor";
import { requireRole } from "../../auth/server/require-role";

/** The catalog operations a caller can attempt before the guard runs. */
export type CatalogAttemptedAction =
  | "CATALOG_CREATE"
  | "CATALOG_UPDATE"
  | "CATALOG_DEACTIVATE"
  | "CATALOG_REACTIVATE";

export interface RequireCatalogAdminOptions {
  /** The catalog's Prisma model name, e.g. "Method" — recorded on the denial row. */
  entity: string;
  /** The operation the caller attempted, e.g. "CATALOG_CREATE". */
  attemptedAction: CatalogAttemptedAction;
  /** The target row id, when already known before the guard runs. */
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
