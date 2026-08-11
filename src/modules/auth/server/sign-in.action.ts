/**
 * Single entry point for credential sign-in (design.md "Data Flow", D7).
 * Resolves nickname->email inside a scoped tx BEFORE calling Better Auth's
 * own email sign-in — never Better Auth's `username` plugin (D7: that
 * plugin reintroduces its own global-unique-username assumption, the exact
 * problem D4 already solved at the Prisma layer).
 *
 * `tenant` is resolved by the caller (middleware's bootstrap-mode lookup,
 * D2) and passed in explicitly, not read from ambient context — this keeps
 * the ONE generic-failure code path (AC-4) able to see "unknown tenant" /
 * "inactive tenant" up front, without widening `shared/db`'s own
 * `TenantContext` with an `isActive` field it has no other use for.
 */
import { APIError } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { transaction } from "../../../shared/db";
import { runWithContext } from "../../../shared/context/request-context";
import { auth, AUTH_INVALID_CREDENTIALS } from "./auth";

export interface SignInTenant {
  tenantId: string;
  isActive: boolean;
}

export interface SignInInput {
  identifier: string;
  password: string;
}

export interface SignInSuccess {
  ok: true;
  token: string;
  userId: string;
  /**
   * Raw `Set-Cookie` header strings for the session Better Auth just
   * minted (Phase 6.6). `auth.api.signInEmail` is called here as a plain
   * in-process function call — not through `auth.handler(request)` — so
   * nothing forwards its `Set-Cookie` to a real HTTP response on its own.
   * A UI-facing caller (a Next.js Server Action, `submit-sign-in.action.ts`)
   * needs these to establish a REAL browser session via `cookies().set()`
   * (`better-auth/cookies`' own `parseSetCookieHeader`/`toCookieOptions`
   * turn each string into `{name, value, options}`). Callers that only need
   * the generic ok/fail contract (the existing integration tests) can keep
   * ignoring this field — additive, not a breaking change to `SignInResult`.
   */
  setCookie: string[];
}

export interface SignInFailure {
  ok: false;
  code: typeof AUTH_INVALID_CREDENTIALS.code;
  message: string;
}

export type SignInResult = SignInSuccess | SignInFailure;

// A fixed, never-real password's hash, computed once (lazily) and reused
// for every "no real user to check against" case below. Spends roughly the
// same scrypt cost as a genuine verify without needing a real user's hash —
// design.md: "When the identifier resolves to nothing, still run a dummy
// password verification to avoid a timing oracle." The same reasoning
// covers "unknown/inactive tenant": both are checked BEFORE we ever reach
// Better Auth's own sign-in endpoint, which has its own separate dummy-hash
// protection for ITS unknown-email case (see `sign-in.mjs`'s
// `ctx.context.password.hash(password)` calls) — that protection never
// fires for failures caught here, so this module needs its own.
let dummyHash: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("quimia-dummy-password-for-timing-parity");
  return dummyHash;
}

async function runDummyVerify(password: string): Promise<void> {
  await verifyPassword({ hash: await getDummyHash(), password });
}

function genericFailure(): SignInFailure {
  return {
    ok: false,
    code: AUTH_INVALID_CREDENTIALS.code,
    message: AUTH_INVALID_CREDENTIALS.message,
  };
}

async function resolveIdentifierToEmail(
  tenantId: string,
  identifier: string,
): Promise<string | null> {
  return transaction({ tenantId, role: "anonymous" }, async (tx) => {
    const user = await tx.user.findFirst({
      where: { OR: [{ email: identifier }, { nickname: identifier }] },
      select: { email: true },
    });
    return user?.email ?? null;
  });
}

export async function signIn(
  input: SignInInput,
  tenant: SignInTenant | null,
  requestId: string,
): Promise<SignInResult> {
  if (!tenant || !tenant.isActive) {
    await runDummyVerify(input.password);
    return genericFailure();
  }

  return runWithContext(
    { requestId, tenant: { tenantId: tenant.tenantId, role: "anonymous" } },
    async () => {
      const email = await resolveIdentifierToEmail(
        tenant.tenantId,
        input.identifier,
      );
      if (!email) {
        await runDummyVerify(input.password);
        return genericFailure();
      }

      try {
        // `returnHeaders: true` (Phase 6.6) is the same shape
        // `auth-cross-tenant-session-replay.test.ts` already uses to
        // capture a real signed session cookie — `{headers, response}`,
        // where `response` is the ordinary `{token, user}` body. Without
        // this, the caller has no way to hand the browser a real cookie.
        const { headers, response } = await auth.api.signInEmail({
          body: { email, password: input.password },
          returnHeaders: true,
        });
        return {
          ok: true,
          token: response.token,
          userId: response.user.id,
          setCookie: headers.getSetCookie(),
        };
      } catch (error) {
        // Better Auth's own APIError (wrong password) and our own
        // databaseHooks APIError (inactive user, D11) both land here —
        // normalized to the ONE generic envelope (AC-4). No branching on
        // the caught error's code/message — that branching is exactly what
        // AC-4 forbids. A non-APIError (genuine infra failure) is NOT
        // swallowed — it propagates as a real 500, not a fake credentials
        // failure.
        if (error instanceof APIError) {
          return genericFailure();
        }
        throw error;
      }
    },
  );
}
