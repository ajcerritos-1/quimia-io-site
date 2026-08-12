/**
 * Better Auth handler mount (design.md "File Changes"). Delegates every
 * method to `auth.handler`, wrapped in `runWithContext` using the
 * `x-tenant-id`/`x-request-id` headers `src/middleware.ts` sets on every
 * request (D2) — Better Auth's own reads/writes against `user` go through
 * `authPrisma` (the ambient proxy, D1), which throws without an active
 * context.
 *
 * When the subdomain did not resolve to a known tenant, middleware still
 * forwards `x-tenant-id: unresolved` rather than omitting the header —
 * `authPrisma` then scopes RLS-protected reads to a tenant id that can
 * never match a real row (fail-closed, not a crash), which is the correct
 * behavior for e.g. Better Auth's `/get-session` on an unresolved host.
 *
 * AC-4 fix (CRITICAL-1, sdd-verify FAIL): this route mounts Better Auth's
 * OWN handler directly, bypassing `signIn()`'s generic-failure funnel
 * (`sign-in.action.ts`) entirely. Two DIFFERENT `APIError`s can reach this
 * handler for what the spec treats as ONE failure: Better Auth's own
 * `INVALID_EMAIL_OR_PASSWORD` (wrong password / unknown email) and the
 * app's D11 `databaseHooks.session.create.before` `AUTH_INVALID_CREDENTIALS`
 * (inactive user) — different code, different message, an account-state
 * oracle. `normalizeAuthFailure` rewrites every 401 this route produces to
 * the single envelope (`shared/http/errors`' `toErrorResponse`, closing W1
 * for this route too). Every 401 this mounted route can currently produce
 * IS a credential failure — `get-session` with no cookie returns 200 + null,
 * not 401 (see `auth-route-mount.test.ts`) — so this stays narrowly correct
 * without branching on which Better Auth sub-path failed.
 */
import { randomUUID } from "node:crypto";
import { runWithContext } from "../../../../shared/context/request-context";
import { auth, AUTH_INVALID_CREDENTIALS } from "../../../../modules/auth/server/auth";
import { UNRESOLVED_TENANT } from "../../../../middleware";
import { AppError, toErrorResponse } from "../../../../shared/http/errors";

const AUTH_FAILURE_STATUS = 401;

async function normalizeAuthFailure(response: Response): Promise<Response> {
  if (response.status !== AUTH_FAILURE_STATUS) return response;

  const envelope = toErrorResponse(
    new AppError(AUTH_INVALID_CREDENTIALS.code, AUTH_INVALID_CREDENTIALS.message, {
      status: AUTH_FAILURE_STATUS,
    }),
  );
  return Response.json(envelope, { status: AUTH_FAILURE_STATUS });
}

async function handle(request: Request): Promise<Response> {
  const tenantId = request.headers.get("x-tenant-id") ?? UNRESOLVED_TENANT;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  const response = await runWithContext(
    { requestId, tenant: { tenantId, role: "anonymous" } },
    () => auth.handler(request),
  );

  return normalizeAuthFailure(response);
}

export const GET = handle;
export const POST = handle;
