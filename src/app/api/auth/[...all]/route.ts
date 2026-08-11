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
 */
import { randomUUID } from "node:crypto";
import { runWithContext } from "../../../../shared/context/request-context";
import { auth } from "../../../../modules/auth/server/auth";
import { UNRESOLVED_TENANT } from "../../../../middleware";

async function handle(request: Request): Promise<Response> {
  const tenantId = request.headers.get("x-tenant-id") ?? UNRESOLVED_TENANT;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  return runWithContext(
    { requestId, tenant: { tenantId, role: "anonymous" } },
    () => auth.handler(request),
  );
}

export const GET = handle;
export const POST = handle;
