/**
 * Admin-only guard on top of `getCurrentActor()` (Story 1.2 Task 3, AC-4).
 * Denies a non-admin caller with a 403 `AppError` AND writes an `AuditLog`
 * row recording the denied attempt BEFORE throwing — AC-4's "the attempt
 * itself is logged" requirement, not merely "the action was blocked".
 *
 * Scoped to THIS story's own admin-only actions (Tasks 4-6) — do not build
 * Story 1.3's general everywhere-RBAC framework here. Story 1.3 will very
 * likely generalize/refactor this into a reusable `requireRole()` used by
 * every module; this lives in `src/modules/auth/server/` specifically so
 * that story has something to extend rather than duplicate.
 *
 * The optional `options` parameter (code-review follow-up 2026-08-16) lets
 * each call site identify what it was attempting BEFORE the guard runs, so
 * the denied-attempt `AuditLog` row records more than just "someone tried
 * something": `attemptedAction` names the action (e.g. `"USER_CREATE"`),
 * and `targetUserId` — when already known before the guard runs, e.g.
 * edit-role/deactivate/reactivate all know the target id from their own
 * Zod-validated input — becomes the row's `entityId` instead of always
 * falling back to the denied actor's own id.
 */
import { transaction, writeAuditLog } from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import {
  getCurrentActor,
  type Actor,
  type CurrentActorRequest,
} from "./get-current-actor";

export const ADMIN_ACTION_DENIED = {
  code: "FORBIDDEN",
  message: "You do not have permission to perform this action.",
} as const;

export interface RequireAdminOptions {
  /** e.g. "USER_CREATE", "USER_ROLE_CHANGE", "USER_DEACTIVATE", "USER_REACTIVATE". */
  attemptedAction: string;
  /** The action's target user, when already known before the guard runs. */
  targetUserId?: string;
}

export async function requireAdmin<T>(
  request: CurrentActorRequest,
  fn: (actor: Actor) => Promise<T>,
  options?: RequireAdminOptions,
): Promise<T> {
  return getCurrentActor(request, async (actor) => {
    if (actor.role !== "admin") {
      await transaction(
        { tenantId: actor.tenantId, role: actor.role },
        async (tx) => {
          await writeAuditLog(tx, {
            tenantId: actor.tenantId,
            entity: "User",
            entityId: options?.targetUserId ?? actor.userId,
            action: "USER_ADMIN_ACTION_DENIED",
            before: null,
            after: options
              ? { attemptedAction: options.attemptedAction }
              : null,
            actorUserId: actor.userId,
          });
        },
      );
      throw new AppError(
        ADMIN_ACTION_DENIED.code,
        ADMIN_ACTION_DENIED.message,
        { status: 403 },
      );
    }
    return fn(actor);
  });
}
