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
import "server-only";
import { cache } from "react";
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

/**
 * The expensive, request-scoped session + user resolution, memoized so the
 * shell layout and any nested page's independent `getCurrentActor()` calls
 * each don't pay for a second `auth.api.getSession` + `scoped().user
 * .findUnique` within the same HTTP request.
 *
 * Why THIS memoization key (P4 code review): `cache()` dedupes by argument
 * identity AND by React's per-request cache scope. Keying on
 * `(headers, tenantId)` works because `headers()` from `next/headers`
 * returns the SAME `Headers` object reference for every call within one HTTP
 * request (Next.js caches it on the request's work-unit store — verified in
 * `next/dist/server/request/headers.js`), so both the layout and the page
 * pass an identical `headers` reference here and the cache actually hits.
 * `tenantId` is the same string on both calls too (read from that same
 * headers object), and it's the only request-derived value that scopes the
 * user lookup. React's per-request cache scope guarantees there is NO
 * cross-request leakage even though the key is partly an object reference —
 * no `requestId` is needed in the key because a single request always
 * resolves the same session from the same headers.
 *
 * This deliberately caches ONLY the session+user resolution — the generic
 * auth-error envelope (thrown here) and `getCurrentActor`'s `fn`
 * re-run-with-context semantics are untouched. The re-run of `fn` under the
 * real role is NOT cached, so a caller's own per-invocation side effects
 * still run exactly once per `getCurrentActor()` call, as before.
 */
const resolveActorFromSession = cache(
  async (headers: Headers, tenantId: string): Promise<Actor> => {
    const session = await auth.api.getSession({ headers });
    if (!session) throw genericAuthError();

    const user = await scoped({ tenantId, role: "anonymous" }).user.findUnique(
      { where: { id: session.user.id } },
    );
    if (!user || !user.isActive) throw genericAuthError();

    return { tenantId, userId: user.id, role: user.role };
  },
);

export async function getCurrentActor<T>(
  request: CurrentActorRequest,
  fn: (actor: Actor) => Promise<T>,
): Promise<T> {
  const { headers: requestHeaders, tenantId, requestId } = request;

  // First `runWithContext` at `role: "anonymous"` — `auth.api.getSession`
  // needs `authPrisma`'s ambient context to read the session (see the file
  // header comment). The cached resolution is called INSIDE this context so
  // the DB reads see it; the cache still dedupes because its args are
  // identical across the layout/page calls.
  const actor = await runWithContext(
    { requestId, tenant: { tenantId, role: "anonymous" } },
    () => resolveActorFromSession(requestHeaders, tenantId),
  );

  // Re-enter `runWithContext` a SECOND time with the REAL resolved role
  // before calling `fn` — "everything that follows" runs under the caller's
  // real tenant/role context, not the anonymous one used only to resolve
  // who's asking.
  return runWithContext(
    { requestId, tenant: { tenantId, role: actor.role } },
    () => fn(actor),
  );
}
