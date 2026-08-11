"use server";

/**
 * Next.js Server Action wrapping `signIn()` (Phase 6.6, design.md
 * "File Changes": `src/modules/auth/ui/sign-in-form.tsx`). This is the ONE
 * thing a client component may call directly — `signIn()` itself stays a
 * plain server-module function, not a Server Action, so it keeps being
 * callable in-process from tests exactly like it already is (8 passing
 * integration tests in `tests/integration/auth-sign-in.test.ts`).
 *
 * Two responsibilities on top of `signIn()`:
 *
 * 1. Resolve `tenant` from the request's `Host` header, the same way
 *    `src/middleware.ts` does (`extractSubdomain` + `bootstrap.
 *    resolveTenantBySlug`) — `signIn()` takes tenant resolution as the
 *    CALLER's responsibility by design (its own header comment), and this
 *    is that caller.
 * 2. Forward the real session cookie to the browser. `signIn()` calls
 *    `auth.api.signInEmail` as a plain in-process function (not through
 *    `auth.handler(request)`), so nothing sets a real `Set-Cookie` on any
 *    HTTP response on its own — `SignInSuccess.setCookie` (Phase 6.6
 *    addition) carries the raw header strings; `better-auth/cookies`'
 *    `parseSetCookieHeader`/`toCookieOptions` turn each into
 *    `{name, value, options}` for `next/headers`' `cookies().set()`.
 *
 * The PUBLIC return shape deliberately excludes `token`/`setCookie` — this
 * is a Server Action, so its return value is serialized straight to
 * client-side JS. Sending the raw signed session cookie back through that
 * channel (on top of setting it as HttpOnly) would partially defeat the
 * point of HttpOnly. The client only ever learns ok/generic-message (AC-4).
 */
import { cookies, headers } from "next/headers";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { bootstrap } from "../../../shared/db";
import { extractSubdomain } from "../../../shared/http/subdomain";
import { signIn, type SignInInput, type SignInTenant } from "./sign-in.action";

export type SubmitSignInResult = { ok: true } | { ok: false; message: string };

async function resolveTenantFromHost(): Promise<SignInTenant | null> {
  const requestHeaders = await headers();
  const slug = extractSubdomain(requestHeaders.get("host"));
  if (!slug) return null;

  const tenant = await bootstrap.resolveTenantBySlug(slug);
  if (!tenant) return null;

  return { tenantId: tenant.id, isActive: tenant.isActive };
}

export async function submitSignIn(
  input: SignInInput,
): Promise<SubmitSignInResult> {
  const requestHeaders = await headers();
  const requestId = requestHeaders.get("x-request-id") ?? crypto.randomUUID();
  const tenant = await resolveTenantFromHost();

  const result = await signIn(input, tenant, requestId);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const cookieStore = await cookies();
  for (const setCookieHeader of result.setCookie) {
    for (const [name, attributes] of parseSetCookieHeader(setCookieHeader)) {
      cookieStore.set(name, attributes.value, toCookieOptions(attributes));
    }
  }

  return { ok: true };
}
