/**
 * Next.js middleware (design.md "Data Flow", D2). Runs on EVERY request —
 * not only sign-in — resolving `tenantId` from the subdomain via
 * bootstrap mode BEFORE anything else happens. This is what makes the
 * cross-tenant session-replay check below possible: a session minted for
 * tenant A, replayed against tenant B's host, is rejected here — before
 * any protected route or action ever sees the request.
 *
 * The resolved `tenantId`/`requestId` are propagated to downstream Route
 * Handlers and Server Actions via request headers (`x-tenant-id`,
 * `x-request-id`) — middleware and the framework's later dispatch to a
 * Route Handler are separate invocations, so `AsyncLocalStorage` set here
 * does not itself carry over; headers are the supported bridge.
 */
import { randomUUID } from "node:crypto";
import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import { bootstrap } from "./shared/db";
import { AUTH_INVALID_CREDENTIALS } from "./modules/auth/server/auth";
import { extractSubdomain } from "./shared/http/subdomain";
import { AppError, toErrorResponse } from "./shared/http/errors";
import { logger } from "./shared/logging/logger";
import { runWithContext } from "./shared/context/request-context";

// Sentinel used when the host's subdomain does not resolve to a known,
// active tenant. Never a valid cuid2 tenant id, so it can never
// accidentally match a real `Session.tenantId` in the replay check below.
export const UNRESOLVED_TENANT = "unresolved";

/**
 * `getSessionCookie` returns the cookie's raw stored value, which is
 * Better Auth's SIGNED form `${token}.${signature}` (better-call's own
 * `getSignedCookie` splits on the LAST `.` — matched here so a signature
 * that happens to end in a base64 `=` padding character never gets
 * mistaken for part of the token). This function does NOT verify that
 * signature, nor touch the DB for anything beyond the lookup below — fine
 * for this early, cheap check: a forged/unsigned token simply will not
 * match any real `Session.token` row, so it resolves to "no session" and
 * falls through to the ordinary unauthenticated path. The REAL trust
 * boundary (signature verification via `auth.api.getSession`) still
 * applies wherever a route actually establishes a session — this check
 * exists only to catch a REAL, correctly-signed session being replayed
 * against the wrong tenant, before it ever reaches one.
 *
 * `auth.api.getSession()` itself cannot be reused for this check: it also
 * loads the session's `user` row under whatever tenant context is active,
 * and when that context is the WRONG tenant the `user` join is RLS-blocked
 * — Better Auth then treats the whole session as not found, which is
 * indistinguishable from "no session at all" and defeats this exact check
 * (confirmed empirically against a real Neon branch — see apply-progress).
 */
function extractRawSessionToken(request: NextRequest): string | null {
  const signedValue = getSessionCookie(request);
  if (!signedValue) return null;

  const signatureStartPos = signedValue.lastIndexOf(".");
  if (signatureStartPos < 1) return null;

  return signedValue.substring(0, signatureStartPos);
}

async function rejectCrossTenantSessionReplay(
  request: NextRequest,
  resolvedTenantId: string,
): Promise<NextResponse | null> {
  const token = extractRawSessionToken(request);
  if (!token) return null;

  const session = await bootstrap.findSessionTenantByToken(token);
  if (session && session.tenantId !== resolvedTenantId) {
    // Single API error envelope (platform-foundation spec, W1): built via
    // the same `AppError`/`toErrorResponse` helper every other error
    // response in this story's request path now goes through, instead of
    // hand-rolling `{ error: AUTH_INVALID_CREDENTIALS }` directly.
    return NextResponse.json(
      toErrorResponse(
        new AppError(
          AUTH_INVALID_CREDENTIALS.code,
          AUTH_INVALID_CREDENTIALS.message,
          { status: 401 },
        ),
      ),
      { status: 401 },
    );
  }
  return null;
}

export async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  const requestId = randomUUID();
  const slug = extractSubdomain(request.headers.get("host"));
  const tenant = slug ? await bootstrap.resolveTenantBySlug(slug) : null;
  const tenantId = tenant?.id ?? UNRESOLVED_TENANT;

  // Structured JSON logging (platform-foundation spec, W2): a real,
  // production call site for `createLogger`/`logger`, demonstrating the
  // D8-shared AsyncLocalStorage store actually attaches `tenant_id` and
  // `request_id` to a real log line for this story's request path.
  // Wrapped in `runWithContext` because middleware's own context does not
  // otherwise carry over to a later Route Handler/Server Action (D2's own
  // header comment) — this log call needs it for its own synchronous
  // extent only.
  runWithContext({ requestId, tenant: { tenantId, role: "anonymous" } }, () => {
    logger.info({ slug }, tenant ? "tenant bootstrap resolved" : "tenant bootstrap unresolved");
  });

  const replayRejection = await rejectCrossTenantSessionReplay(
    request,
    tenantId,
  );
  if (replayRejection) return replayRejection;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-tenant-id", tenantId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  // Phase 7 discovery: Next.js middleware defaults to the Edge Runtime,
  // which cannot load `node:crypto`/`node:path`/`node:url` — needed
  // transitively via `src/shared/db`'s generated Prisma client (this
  // middleware's own `bootstrap.resolveTenantBySlug`/
  // `findSessionTenantByToken` calls). PR 4a never surfaced this: its
  // integration tests call `middleware()` directly as a plain function,
  // bypassing the Edge Runtime entirely — this is the first time the app
  // has actually been run through `next dev`/`next start` (Phase 7's e2e
  // harness). `runtime: "nodejs"` opts this middleware into the Node.js
  // runtime instead — no logic change, config-only.
  runtime: "nodejs",
};
