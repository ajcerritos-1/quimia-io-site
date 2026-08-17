/**
 * Session -> resolved actor (Story 1.2 Task 3, AD-3, D8). The first
 * authenticated-action helper this codebase has needed — everything before
 * this either runs with `role: "anonymous"` (middleware, sign-in's own
 * pre-auth lookups) or is Better Auth's own internal session-creation hook.
 *
 * Reads the session via Better Auth's own `auth.api.getSession` (needs
 * `authPrisma`'s ambient context, hence the FIRST `runWithContext` at
 * `role: "anonymous"`), then re-reads the `user` row fresh via `scoped()`
 * directly — not `authPrisma` — because there is no role yet to hand the
 * ambient proxy (same reasoning as `auth.ts`'s
 * `databaseHooks.session.create.before`).
 *
 * Re-checks `isActive` HERE too, not only at sign-in: Story 1.1's
 * `databaseHooks.session.create.before` only rejects an inactive user at
 * session-CREATION time (i.e. their next sign-in) — an already-existing
 * session for a user who gets deactivated mid-session is never re-checked
 * anywhere else (`cookieCache: { enabled: false }` only means the row is
 * re-fetched fresh every request, not that anything rejects on
 * `isActive: false`). Without this check, a currently-logged-in deactivated
 * user would keep working until their session naturally expires.
 *
 * Re-enters `runWithContext` a SECOND time with the REAL resolved role
 * before calling `fn` — "everything that follows" (the caller's own
 * callback) runs under the caller's real tenant/role context, not the
 * anonymous one used only to resolve who's asking.
 *
 * Any failure here (no session, inactive user) rejects with the exact same
 * generic `AUTH_INVALID_CREDENTIALS` envelope Story 1.1 already established
 * for sign-in (AC-4's "no hint" posture) — never a field- or reason-specific
 * message.
 */
import { runWithContext } from "../../../shared/context/request-context";
import { scoped, type UserRole } from "../../../shared/db";
import { AppError } from "../../../shared/http/errors";
import { auth, AUTH_INVALID_CREDENTIALS } from "./auth";

export interface Actor {
  tenantId: string;
  userId: string;
  role: UserRole;
}

export interface CurrentActorRequest {
  /** The incoming request's headers — carries the session cookie. */
  headers: Headers;
  /** Resolved by middleware (`x-tenant-id`), not re-derived here. */
  tenantId: string;
  requestId: string;
}

function genericAuthError(): AppError {
  return new AppError(
    AUTH_INVALID_CREDENTIALS.code,
    AUTH_INVALID_CREDENTIALS.message,
    { status: 401 },
  );
}

export async function getCurrentActor<T>(
  request: CurrentActorRequest,
  fn: (actor: Actor) => Promise<T>,
): Promise<T> {
  const { headers: requestHeaders, tenantId, requestId } = request;

  return runWithContext(
    { requestId, tenant: { tenantId, role: "anonymous" } },
    async () => {
      const session = await auth.api.getSession({ headers: requestHeaders });
      if (!session) throw genericAuthError();

      const user = await scoped({ tenantId, role: "anonymous" }).user.findUnique(
        { where: { id: session.user.id } },
      );
      if (!user || !user.isActive) throw genericAuthError();

      const actor: Actor = { tenantId, userId: user.id, role: user.role };

      return runWithContext(
        { requestId, tenant: { tenantId, role: actor.role } },
        () => fn(actor),
      );
    },
  );
}
