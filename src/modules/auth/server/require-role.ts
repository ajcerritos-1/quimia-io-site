/**
 * The single, shared role-check guard (Story 1.3 Task 2, AC 1/2/3/7) — the
 * generalization `require-admin.ts`'s own header comment named: "Story 1.3
 * will very likely generalize/refactor this into a reusable `requireRole()`
 * used by every module." Any Server Action or Route Handler that needs to
 * restrict access to one or more specific roles composes THIS guard — no
 * module hand-rolls its own role comparison or its own denial-audit write.
 *
 * Composes `getCurrentActor()` exactly like `require-admin.ts` did before
 * this refactor, then checks `isRoleAllowed()` (Task 1's helper — the ONE
 * place role-comparison logic lives, never inlined here). On denial: writes
 * ONE `AuditLog` row via `transaction()` + `writeAuditLog` BEFORE throwing a
 * 403 `AppError` (AD-10's single write path, generalized).
 *
 * `require-admin.ts` is now a thin wrapper over this function — see that
 * file for the exact backward-compatible call it makes.
 */
import "server-only";
import { transaction, writeAuditLog, type UserRole } from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import { isRoleAllowed } from "../roles";
import {
  getCurrentActor,
  type Actor,
  type CurrentActorRequest,
} from "./get-current-actor";

export const ROLE_ACTION_DENIED = {
  code: "FORBIDDEN",
  message: "You do not have permission to perform this action.",
} as const;

export interface RequireRoleOptions {
  /** What entity this denial's `AuditLog` row is about, e.g. "User". */
  entity: string;
  /** The denial's own audit `action` name, e.g. "USER_ADMIN_ACTION_DENIED". */
  action: string;
  /** The specific action the caller attempted, recorded in `after`. */
  attemptedAction?: string;
  /** The action's target entity, when already known before the guard runs. */
  entityId?: string;
}

export async function requireRole<T>(
  request: CurrentActorRequest,
  allowedRoles: UserRole[],
  fn: (actor: Actor) => Promise<T>,
  options: RequireRoleOptions,
): Promise<T> {
  return getCurrentActor(request, async (actor) => {
    if (!isRoleAllowed(actor.role, allowedRoles)) {
      await transaction(
        { tenantId: actor.tenantId, role: actor.role },
        async (tx) => {
          await writeAuditLog(tx, {
            tenantId: actor.tenantId,
            entity: options.entity,
            entityId: options.entityId ?? actor.userId,
            action: options.action,
            before: null,
            after:
              options.attemptedAction !== undefined
                ? { attemptedAction: options.attemptedAction }
                : null,
            actorUserId: actor.userId,
          });
        },
      );
      throw new AppError(
        ROLE_ACTION_DENIED.code,
        ROLE_ACTION_DENIED.message,
        { status: 403 },
      );
    }
    return fn(actor);
  });
}
