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
 *
 * Story 1.4 Task 5 (AC 2): account lockout after repeated failed sign-in
 * attempts. Verifies the submitted password directly against the resolved
 * `Account.password` hash BEFORE calling Better Auth's own
 * `signInEmail` — Dev Notes explain why this manual pre-verification is
 * preferred over pattern-matching Better Auth's internal `APIError`
 * (fragile, liable to break silently on a Better Auth version bump). The
 * single invariant this must never violate: a locked account's failure is
 * BYTE-IDENTICAL to every other failure in this file (AC-4's envelope) —
 * the lockout event is signaled ONLY via an `AuditLog` row
 * (`USER_ACCOUNT_LOCKED`), never a distinct user-facing message.
 */
import { APIError } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { transaction, writeAuditLog } from "../../../shared/db";
import { runWithContext } from "../../../shared/context/request-context";
import { AppError, toErrorResponse } from "../../../shared/http/errors";
import { logger } from "../../../shared/logging/logger";
import {
  LOCKOUT_DURATION_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "./account-lockout";
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

// Single API error envelope (platform-foundation spec, W1): `genericFailure`
// derives its code/message through the SAME `AppError`/`toErrorResponse`
// helper every other error response in this story's request path uses,
// instead of reading `AUTH_INVALID_CREDENTIALS.code`/`.message` directly.
// `SignInFailure`'s own `{ok, code, message}` shape is unchanged — this is
// a real call site for the helper, not a new response shape.
function genericFailure(): SignInFailure {
  const { error } = toErrorResponse(
    new AppError(AUTH_INVALID_CREDENTIALS.code, AUTH_INVALID_CREDENTIALS.message, {
      status: 401,
    }),
  );
  return {
    ok: false,
    code: error.code as typeof AUTH_INVALID_CREDENTIALS.code,
    message: error.message,
  };
}

interface ResolvedSignInUser {
  id: string;
  email: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  /** `null` when the resolved user has no matching credential `Account` row
   * (`providerId: "credential"`) — should not happen for any user created
   * via `create-user.action.ts`, but handled defensively rather than
   * assumed. */
  passwordHash: string | null;
}

async function resolveUserForSignIn(
  tenantId: string,
  identifier: string,
): Promise<ResolvedSignInUser | null> {
  return transaction({ tenantId, role: "anonymous" }, async (tx) => {
    const user = await tx.user.findFirst({
      where: { OR: [{ email: identifier }, { nickname: identifier }] },
      select: {
        id: true,
        email: true,
        isActive: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        accounts: {
          where: { providerId: "credential" },
          select: { password: true },
          take: 1,
        },
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      passwordHash: user.accounts[0]?.password ?? null,
    };
  });
}

// Task 5, step 3: a failed verify increments the counter; the crossing of
// `MAX_FAILED_LOGIN_ATTEMPTS` (not every attempt below it) also sets
// `lockedUntil` and writes ONE `AuditLog` row via the shared `writeAuditLog`
// wrapper (AD-10's single write path). No acting admin exists for a
// self-triggered lockout — the locked-out user's own id is `actorUserId`
// (Dev Notes: "who this action is about", not a new nullable actor field).
async function recordFailedAttempt(
  tenantId: string,
  user: ResolvedSignInUser,
): Promise<void> {
  const newCount = user.failedLoginAttempts + 1;
  const crossesThreshold = newCount >= MAX_FAILED_LOGIN_ATTEMPTS;

  await transaction({ tenantId, role: "anonymous" }, async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newCount,
        ...(crossesThreshold
          ? {
              lockedUntil: new Date(
                Date.now() + LOCKOUT_DURATION_MINUTES * 60_000,
              ),
            }
          : {}),
      },
    });
    if (crossesThreshold) {
      await writeAuditLog(tx, {
        tenantId,
        entity: "User",
        entityId: user.id,
        action: "USER_ACCOUNT_LOCKED",
        actorUserId: user.id,
      });
    }
  });
}

// Task 5, step 4: a successful verify clears the counter/lock — run
// unconditionally (a plain UPDATE on an already-0/null row is cheap, and
// keeps this call site branch-free).
async function resetFailedAttempts(tenantId: string, userId: string): Promise<void> {
  await transaction({ tenantId, role: "anonymous" }, async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });
}

export async function signIn(
  input: SignInInput,
  tenant: SignInTenant | null,
  requestId: string,
): Promise<SignInResult> {
  if (!tenant || !tenant.isActive) {
    await runDummyVerify(input.password);
    // No scoped context exists yet for an unknown/inactive tenant — log
    // under a bare `runWithContext` so this line still carries a real
    // `tenant_id`/`request_id` pair (platform-foundation spec, W2) rather
    // than falling through to the logger's "unknown" defaults.
    runWithContext(
      { requestId, tenant: { tenantId: tenant?.tenantId ?? "unknown", role: "anonymous" } },
      () => {
        logger.warn({ reason: "unknown_or_inactive_tenant" }, "sign-in failed");
      },
    );
    return genericFailure();
  }

  return runWithContext(
    { requestId, tenant: { tenantId: tenant.tenantId, role: "anonymous" } },
    async () => {
      const resolved = await resolveUserForSignIn(
        tenant.tenantId,
        input.identifier,
      );
      if (!resolved) {
        await runDummyVerify(input.password);
        logger.warn({ reason: "unknown_identifier" }, "sign-in failed");
        return genericFailure();
      }

      // Do NOT count a deactivated user's attempt toward the lockout
      // threshold (Task 5) — deactivation (Story 1.2) is already a
      // stronger, permanent block. Still run the dummy verify so this
      // branch costs the same as every other rejecting branch (no timing
      // oracle for "which accounts are inactive").
      if (!resolved.isActive) {
        await runDummyVerify(input.password);
        logger.warn({ reason: "inactive_user" }, "sign-in failed");
        return genericFailure();
      }

      // AC 2 / Dev Notes: a locked account's failure MUST be
      // byte-identical to every other failure here — no distinct
      // "account locked" message, ever. The lockout is signaled only via
      // the AuditLog row `recordFailedAttempt` already wrote when the
      // threshold was crossed.
      if (resolved.lockedUntil && resolved.lockedUntil.getTime() > Date.now()) {
        await runDummyVerify(input.password);
        logger.warn({ reason: "account_locked" }, "sign-in failed");
        return genericFailure();
      }

      if (!resolved.passwordHash) {
        // No credential row to verify against — treat like "no real user"
        // rather than a countable failed attempt (there is nothing real to
        // guess against).
        await runDummyVerify(input.password);
        logger.warn({ reason: "no_credential" }, "sign-in failed");
        return genericFailure();
      }

      const passwordValid = await verifyPassword({
        hash: resolved.passwordHash,
        password: input.password,
      });

      if (!passwordValid) {
        await recordFailedAttempt(tenant.tenantId, resolved);
        logger.warn({ reason: "invalid_credentials" }, "sign-in failed");
        return genericFailure();
      }

      await resetFailedAttempts(tenant.tenantId, resolved.id);

      try {
        // `returnHeaders: true` (Phase 6.6) is the same shape
        // `auth-cross-tenant-session-replay.test.ts` already uses to
        // capture a real signed session cookie — `{headers, response}`,
        // where `response` is the ordinary `{token, user}` body. Without
        // this, the caller has no way to hand the browser a real cookie.
        // The password was already verified above (Task 5) — this call
        // repeats that verify internally (Better Auth's own codepath),
        // an accepted, negligible extra cost (Dev Notes) in exchange for
        // an unambiguous internal signal with no error-message sniffing.
        const { headers, response } = await auth.api.signInEmail({
          body: { email: resolved.email, password: input.password },
          returnHeaders: true,
        });
        logger.info({ userId: response.user.id }, "sign-in succeeded");
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
          logger.warn({ reason: "invalid_credentials" }, "sign-in failed");
          return genericFailure();
        }
        throw error;
      }
    },
  );
}
