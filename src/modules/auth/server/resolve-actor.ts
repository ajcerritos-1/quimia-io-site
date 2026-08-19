/**
 * Shared authenticated-actor resolver (Story 1.5 code review, P3). Extracts
 * the ~15-line header-parsing + `getCurrentActor` + 401-redirect boilerplate
 * that `(app)/layout.tsx` (`resolveShellActor`) and `(app)/page.tsx`
 * (`resolveActor`) previously each duplicated verbatim. Both now import and
 * call THIS one function — one place to change if the redirect-on-401 /
 * unresolved-tenant behavior ever needs to evolve.
 *
 * The two call sites still call it independently (the layout and its nested
 * page each resolve the actor themselves — Next.js Server Components don't
 * pass data from a layout down to its page via props), but they share the
 * boilerplate. The actual `getCurrentActor()` resolution is memoized per
 * request via React's `cache()` (see `get-current-actor.ts`), so the two
 * independent calls no longer each pay for a duplicate session + user query.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { UNRESOLVED_TENANT } from "@/middleware";
import { AppError } from "@/shared/http/errors";
import {
  getCurrentActor,
  type Actor,
} from "@/modules/auth/server/get-current-actor";

/**
 * Resolves the signed-in actor for the current request, or redirects/404s
 * for an unauthenticated or unresolved-tenant request:
 * - missing / unresolved `x-tenant-id` header -> `notFound()` (no tenant
 *   to scope the request against);
 * - an `AppError` with `status === 401` (no session / inactive user) ->
 *   `redirect("/sign-in")`.
 */
export async function resolveActor(): Promise<Actor> {
  const requestHeaders = await headers();
  const tenantId = requestHeaders.get("x-tenant-id");
  if (!tenantId || tenantId === UNRESOLVED_TENANT) notFound();
  const requestId = requestHeaders.get("x-request-id") ?? randomUUID();

  try {
    return await getCurrentActor(
      { headers: requestHeaders, tenantId, requestId },
      async (actor) => actor,
    );
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/sign-in");
    throw error;
  }
}
