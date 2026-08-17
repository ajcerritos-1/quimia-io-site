/**
 * Admin-only guard (Story 1.2 Task 3, AC-4) — now a thin wrapper over the
 * general `requireRole()` guard (Story 1.3 Task 2), exactly as this file's
 * own header comment previously anticipated: "Story 1.3 will very likely
 * generalize/refactor this into a reusable `requireRole()` used by every
 * module." External signature and behavior are UNCHANGED — same 403
 * `AppError`, same `AuditLog` row shape (`entity: "User"`, `action:
 * "USER_ADMIN_ACTION_DENIED"`, `entityId`/`after.attemptedAction`) — so
 * every existing call site (`create-user.action.ts`,
 * `update-user-role.action.ts`, `deactivate-user.action.ts`,
 * `reactivate-user.action.ts`, `usuarios/page.tsx`) and Story 1.2's test
 * suite keep working without any call-site or test changes (Story 1.3 AC 4).
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
import { UserRole } from "../../../shared/db";
import type { Actor, CurrentActorRequest } from "./get-current-actor";
import { requireRole, ROLE_ACTION_DENIED } from "./require-role";

/** Kept exported for backward compatibility — same value as before the refactor. */
export const ADMIN_ACTION_DENIED = ROLE_ACTION_DENIED;

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
  return requireRole(request, [UserRole.admin], fn, {
    entity: "User",
    action: "USER_ADMIN_ACTION_DENIED",
    attemptedAction: options?.attemptedAction,
    entityId: options?.targetUserId,
  });
}
