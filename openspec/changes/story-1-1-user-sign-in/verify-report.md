# Verification Report: story-1-1-user-sign-in

**Change**: `story-1-1-user-sign-in`
**Branch verified**: `dev` (all 4 chained PRs merged, working tree clean, HEAD `975fb5b`)
**Mode**: Full spec-driven verification (proposal + 3 specs + design + tasks + apply-progress all present)
**Strict TDD**: ACTIVE - TDD honoring was spot-checked, not assumed
**Verifier context**: fresh/adversarial - every test re-run locally; no apply-progress claim accepted on faith
**Date**: 2026-08-11

**VERDICT: FAIL** - 3 CRITICAL, 6 WARNING, 5 SUGGESTION.
One CRITICAL is a genuine, empirically-reproduced AC-4 (account-state oracle) violation on a
publicly reachable endpoint. It blocks `sdd-archive`.

---

## 1. Test Evidence - Observed vs Claimed

All commands run by the verifier on `dev`. Exit codes captured without pipe masking.

| Command | apply-progress CLAIM | VERIFIER OBSERVED | Match |
|---|---|---|---|
| `npm run test` | 29/29 unit | **29 passed (29), 5 files, 979ms** | MATCHES |
| `npm run test:integration` | 30/30 across 9 files, real Neon branch | **30 passed (30), 9 files, 92.15s**, real ephemeral Neon branch | MATCHES |
| `npx playwright test` | 3/3 e2e | **3 passed (1.5m)** - but only on the **2nd attempt**; the 1st attempt FAILED | DIVERGES (see W5) |
| `npx tsc --noEmit` | clean | **exit 0**, no diagnostics | MATCHES |
| `npx eslint .` | clean | **exit 0**, no findings | MATCHES |

### E2E first-attempt failure (verbatim)

```
[WebServer] Error: P1001: Can't reach database server at `ep-noisy-mode-axwn67ws.c-4.us-east-2.aws.neon.tech:5432`
[WebServer] start-server: failed to start Error: Command failed: npx prisma migrate deploy
    at createEphemeralBranch (C:\Projects\QuimiaIO\scripts\e2e\start-server.ts:115:5)
Error: Process from config.webServer was not able to start. Exit code: 1
```

Not a code defect and not a Neon quota problem - the Neon API showed exactly **1** branch
(`production`) at that moment, and the harness own `catch` correctly deleted the failed branch.
This is a harness readiness race (W5). The identical run passed unchanged on retry:

```
Running 3 tests using 1 worker
  ok 1 [chromium] > Sign-in happy path (7.1) > valid credentials sign the user in and establish a real session (15.3s)
  ok 2 [chromium] > Sign-in invalid credentials (7.2) > wrong password renders the single generic message, no field-specific hint (AC-4) (5.1s)
  ok 3 [chromium] > Sign-in invalid credentials (7.2) > inactive account with a correct password renders the byte-for-byte identical generic message (D11) (7.6s)
  3 passed (1.5m)
```

### Test-quality spot check (are the tests real or tautological?)

Real. Verified by reading the test sources against the implementations:

- `db-rls-fail-closed.test.ts` / `db-scoped-isolation.test.ts` / `harness-smoke.test.ts` open **raw pg.Client
  connections to a real ephemeral Neon branch** and assert on actual Postgres behavior (row counts,
  `permission denied`, `row-level security` violation). No Prisma mock exists anywhere in the suite.
- `harness-smoke.test.ts` asserts `pg_class.relforcerowsecurity = true` at runtime - a genuine DDL-state
  assertion, not a comment.
- `auth-sign-in.test.ts` seeds real scrypt hashes via better-auth/crypto `hashPassword` and drives the
  real `signIn()`, asserting `toEqual(GENERIC_FAILURE)` (whole-object equality, so byte-for-byte).
- `auth-cross-tenant-session-replay.test.ts` performs a **real** `auth.api.signInEmail`, captures the real
  signed Set-Cookie, and replays it against the wrong host through the real `middleware()`.
- `db-eslint-boundary.test.ts` runs the **real ESLint flat config** through ESLint Node API against a
  planted violation - and asserts the negative case (no false positive inside `src/shared/db`).

TDD deviations flagged in apply-progress (5.3/5.4 built with 5.1; Better Auth integration read-then-write;
one of three e2e RED runs muddied by Neon cold-start flake) were self-disclosed honestly and match what
the code and commit history show. No fabricated RED cycles found.

---

## 2. CRITICAL Findings

### CRITICAL-1 - AC-4 account-state oracle on the public `/api/auth/[...all]` route

**Spec violated**: `specs/auth-sign-in/spec.md` -> "Generic Authentication Failure Message" ->
scenario *"Inactive account with valid credentials"*: *"THEN the response is **byte-for-byte the same**
generic message as the invalid-password case."*
Also `design.md`: *"One code AUTH_INVALID_CREDENTIALS, one message, for all of: unknown tenant,
inactive tenant, unknown identifier, wrong password, inactive user."*

`src/app/api/auth/[...all]/route.ts` (task 6.7) mounts Better Auth own handler with `GET`/`POST`
exports. The `src/middleware.ts` matcher `["/((?!_next/static|_next/image|favicon.ico).*)"]` includes it,
so `POST https://{lab}.quimiaio.com/api/auth/sign-in/email` is **publicly reachable** and completely
bypasses the `signIn()` generic-failure funnel in `sign-in.action.ts`.

**Empirically reproduced** by the verifier via a temporary probe test against a real Neon branch
(probe created, executed, and deleted - working tree left clean):

```json
{
  "wrongPassword": { "status": 401,
    "body": "{\"message\":\"Invalid email or password\",\"code\":\"INVALID_EMAIL_OR_PASSWORD\"}" },
  "inactiveUser":  { "status": 401,
    "body": "{\"code\":\"AUTH_INVALID_CREDENTIALS\",\"message\":\"Invalid credentials.\"}" },
  "unknownEmail":  { "status": 401,
    "body": "{\"message\":\"Invalid email or password\",\"code\":\"INVALID_EMAIL_OR_PASSWORD\"}" }
}
```

The inactive-user response is **not** byte-for-byte identical to the wrong-password response - different
`code`, different `message`, different key order. That is a direct **account-state oracle**: an attacker
probing this endpoint can distinguish "this account exists but is deactivated" from "bad credentials",
which is exactly the disclosure AC-4 exists to prevent.

Root cause, confirmed in Better Auth compiled source
(`node_modules/better-auth/dist/api/routes/sign-in.mjs:291,297,303,310`):
Better Auth throws `APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD)` for its
own credential failures, while the D11 `databaseHooks.session.create.before` hook in
`src/modules/auth/server/auth.ts:70,80` throws `APIError("UNAUTHORIZED", AUTH_INVALID_CREDENTIALS)`.
Through `signIn()` both are caught and normalized (`sign-in.action.ts:137-149`) - **that path is
correct**. Through the mounted handler nothing normalizes them.

**Why it was missed**: `tests/integration/auth-route-mount.test.ts` covers only the happy path and
get-session-returns-null. It has **zero failure-path coverage** through the mounted route (see W6).

**Scope note (not a mitigation)**: the UI path (`sign-in-form.tsx` -> `submit-sign-in.action.ts` ->
`signIn()`) IS compliant, and the e2e tests correctly prove that. The hole is the *other*, equally
public entry point.

**Remediation direction** (not applied - verification does not fix): either normalize Better Auth error
responses in `route.ts` through the AC-4 envelope via `onAPIError` / a response filter, or stop
exporting `POST` for the sign-in sub-paths so `signIn()` is the only credential entry point.
Either way, add the missing failure-path tests to `auth-route-mount.test.ts`.

### CRITICAL-2 - UNTESTED spec scenario: "Duplicate email within the same tenant is rejected"

**Spec**: `specs/auth-sign-in/spec.md` -> "Multi-Tenant Email and Nickname Uniqueness".
No test anywhere asserts this rejection. Task 6.4 only asked for the *cross-tenant success* case, so the
tasks breakdown under-covered the spec; `auth-sign-in.test.ts:183` covers only that success case.

Mitigating static evidence (verified directly, so real risk is low): `prisma/schema.prisma:56` has
`@@unique([tenantId, email])`, and `prisma/migrations/20260803061542_init/migration.sql:89` emits
`CREATE UNIQUE INDEX "user_tenantId_email_key" ON "user"("tenantId", "email")`, which the harness
applies via `migrate deploy` on every run. Per the verify contract a required spec scenario without a
passing covering test is CRITICAL/UNTESTED regardless. Cheap to close (~15 lines).

### CRITICAL-3 - UNTESTED spec scenario: "Duplicate nickname within the same tenant is rejected"

Same spec requirement, same situation. `prisma/schema.prisma:57` has `@@unique([tenantId, nickname])`;
`migration.sql:92` emits `user_tenantId_nickname_key`. No runtime test proves the rejection.

---

## 3. WARNING Findings

### W1 - "Single API Error Envelope" is not actually enforced anywhere in production
`specs/platform-foundation/spec.md`: *"Every API error response MUST use the single envelope shape
`{ error: { code, message, details? } }`."*
`src/shared/http/errors.ts` (`AppError`, `toErrorResponse`) has **zero production call sites** - verified
by grep across `src/` excluding tests. `src/middleware.ts:68` hand-rolls `{ error: AUTH_INVALID_CREDENTIALS }`
(correct shape, but bypasses the helper), and the public auth route returns Better Auth un-enveloped
top-level `{code, message}` (see CRITICAL-1 probe output - neither response is wrapped in `error`).
The requirement is proven by a unit test of the helper, not by any real API response.

### W2 - "Structured JSON logging with tenant/request context" is vacuously satisfied
`specs/platform-foundation/spec.md`: *"Every log line MUST be structured JSON and MUST carry tenant_id
and request_id."* `src/shared/logging/logger.ts` has **zero production call sites** (grep-verified);
no application code emits a single log line. The requirement passes only because the set of app-emitted
log lines is empty. Meanwhile the e2e run real server produced this **non-structured, context-free**
line from a third party: `2026-08-11T06:02:50.557Z WARN [Better Auth]: Invalid password`. The proposal
success criterion "Every log line carries tenant_id and request_id" is therefore not demonstrated.

### W3 - Bootstrap mode gained a second flow the tenant-isolation spec never authorized
`specs/tenant-isolation/spec.md`: *"The system MUST restrict bootstrap-mode lookups to the
tenant-subdomain resolution flow (this story) reading only an RLS-exempt tenant-resolution table/view."*
`src/shared/db/bootstrap.ts:43` adds `findSessionTenantByToken()`, which reads the `session` table - a
**second** bootstrap flow against a **different** table. The engineering justification is sound and
thoroughly documented in code (`bootstrap.ts:30-42`, `middleware.ts:42-47`) and apply-progress:
`auth.api.getSession()` cannot distinguish "wrong tenant" from "no session" under RLS. It is also
consistent with the spec own "Better Auth Own Tables Are RLS-Exempt by Design" requirement. But this
is precisely the gap the proposal **Open Decision 1** predicted ("AD-3 bootstrap list gains an
explicit fourth named flow"), and the spec text was never amended. Spec/implementation drift - resolve
by amending the tenant-isolation spec bootstrap requirement before archiving.

### W4 - Windows Neon branch leak reproduced on a fully-passing e2e run
Confirmed independently: after the passing `npx playwright test`, the Neon API listed
`test-e2e-local-1786428090398` (`br-wild-haze-axxelp2p`) still alive. The verifier deleted it. This
exactly reproduces apply-progress Deviation #3 and is documented in `docs/neon-branch-cleanup.md`, but
the scheduled-cleanup fix (task 7.3) is documented-only, not implemented. Every local e2e run on Windows
burns one slot of the free-tier concurrent-branch cap.

### W5 - Neither Neon harness waits for endpoint readiness before `prisma migrate deploy`
`scripts/e2e/start-server.ts:115` and `tests/setup/neon-global-setup.ts:117` both call
`execFileSync("npx", ["prisma","migrate","deploy"])` immediately after branch creation +
`reveal_password`, with no readiness poll and no retry. This produced a hard `P1001` failure on the
verifier first e2e attempt (observed rate this session: 1 of 2 e2e runs). The integration harness has
the identical gap and was simply lucky. A bounded connect-retry loop before `migrate deploy` would
remove a whole class of false-red CI failures.

### W6 - `auth-route-mount.test.ts` has no failure-path coverage
It asserts only the 200 happy path and get-session -> `null`. Adding a wrong-password and an
inactive-user assertion through the mounted `POST` would have caught CRITICAL-1 at PR 4a time. This gap
is the direct cause of the CRITICAL above and should be closed alongside it.

---

## 4. SUGGESTION Findings

- **S1** - `next build` emits `The "middleware" file convention is deprecated. Please use "proxy" instead.`
  (Next.js 16.2.12). Forward-compat cleanup; note the `runtime: "nodejs"` fix must survive any migration.
- **S2** - Stale doc comment: `tests/e2e/sign-in.spec.ts:4` says "against a real next dev server"; the
  harness actually runs `next build && next start` (Deviation #2). `scripts/e2e/start-server.ts:8` has the
  same stale "THEN starts next dev" wording.
- **S3** - The ESLint boundary restricts `**/generated/prisma` only. `@prisma/client` and a direct `pg`
  Client are still importable from any app module, so the AD-3 seam is enforced against the *generated*
  client but not against raw connections. Scope a `src/**`-minus-`src/shared/db` restriction over `pg`
  (tests and `scripts/` legitimately need it).
- **S4** - `bootstrap.resolveTenantBySlug` returns tenants regardless of `isActive`, and `middleware.ts:82`
  sets `x-tenant-id` for an inactive tenant. Sign-in correctly rejects inactive tenants in `signIn()`, but
  non-sign-in routes would still open scoped context for a deactivated lab. Outside Story 1.1 ACs;
  decide explicitly before the Story 1.5 app shell.
- **S5** - Every DB-touching run emits `pg-connection-string` SSL-mode deprecation warnings. Pin
  `sslmode=verify-full` in `buildConnectionUri` to silence and future-proof.

---

## 5. Spec Compliance Matrix

Status legend: PASS (covering test passed at runtime) / UNTESTED / FAIL.

### `auth-sign-in`

| Requirement | Scenario | Evidence | Status |
|---|---|---|---|
| Credential sign-in -> tenant-scoped session | Successful sign-in with valid credentials | `auth-sign-in.test.ts` (email + nickname), `sign-in.spec.ts` e2e happy path + real session cookie via `/api/auth/get-session` | PASS |
| Credential sign-in -> tenant-scoped session | Tenant resolution precedes session (bootstrap) | `db-bootstrap.test.ts`, `auth-cross-tenant-session-replay.test.ts`, e2e against real `{slug}.localhost` | PASS |
| Generic auth failure | Invalid password | `auth-sign-in.test.ts` `toEqual(GENERIC_FAILURE)`; e2e `toHaveText("Invalid credentials.")` | PASS (via signIn) |
| Generic auth failure | Inactive account byte-for-byte identical | signIn path PASSES; **public `/api/auth/sign-in/email` path FAILS** | **FAIL (CRITICAL-1)** |
| Multi-tenant uniqueness | Same email succeeds across two tenants | `auth-sign-in.test.ts:183` | PASS |
| Multi-tenant uniqueness | Duplicate email within tenant rejected | none | **UNTESTED (CRITICAL-2)** |
| Multi-tenant uniqueness | Duplicate nickname within tenant rejected | none | **UNTESTED (CRITICAL-3)** |

### `tenant-isolation`

| Requirement | Scenario | Evidence | Status |
|---|---|---|---|
| Wrapper is sole DB access path | No direct prisma model access outside wrapper | `db-eslint-boundary.test.ts` (real ESLint API, both polarities) + independent verifier grep | PASS |
| Wrapper is sole DB access path | Scoped mode sets session context before any query | `db-scoped-isolation.test.ts` (scoped and transaction) | PASS |
| Bootstrap mode narrowly scoped | Sign-in bootstrap lookup is narrow | `db-bootstrap.test.ts` asserts exactly `{id, isActive}`; `harness-smoke.test.ts` proves `SELECT "name" FROM "tenant"` is permission denied | PASS (but see W3) |
| Neon RLS enforces isolation | FORCE RLS enabled via owner role | migration SQL lines 23-35 **and** runtime assertion `relrowsecurity=true, relforcerowsecurity=true` in `harness-smoke.test.ts` | PASS |
| Neon RLS enforces isolation | Runtime connects as non-owner role | `harness-smoke.test.ts` `current_user = quimia_app` + column-narrow denial + fail-closed 0 rows | PASS |
| Better Auth tables RLS-exempt | Queried by token, not tenant context | `auth-cross-tenant-session-replay.test.ts`, `auth-route-mount.test.ts` | PASS |
| Better Auth tables RLS-exempt | Token is the capability gate | anonymous request passes through; get-session -> null without a cookie | PASS (weak - no negative-capability test) |
| RLS verified on real Postgres | Integration test proves isolation on a real Neon branch | 30/30 integration tests, real ephemeral branch, verifier-observed | PASS |
| RLS verified on real Postgres | Mocked Prisma client rejected as evidence | no mock/stub of Prisma exists in any test; `vitest.integration.config.ts` documents the ban | PASS |

### `platform-foundation`

| Requirement | Scenario | Evidence | Status |
|---|---|---|---|
| Typed env configuration | Validated via Zod; no raw process.env in business logic | `env.test.ts`; verifier grep shows `process.env` appears only in `src/shared/config/env.ts:49` | PASS |
| Typed env configuration | Env loaded before Prisma instantiation (P1010 guard) | import-graph convention in `client.ts`; no P1010 in 30 integration + 3 e2e runs | PASS (runtime evidence; no dedicated test) |
| Structured JSON logging | Every log line carries tenant_id / request_id | `logger.test.ts` only; **zero production call sites** | PASS-VACUOUS (W2) |
| Single API error envelope | API errors return `{error:{code,message,details?}}` | `errors.test.ts` only; **zero production call sites**; public auth route returns un-enveloped bodies | PASS-VACUOUS + contradicted (W1) |

---

## 6. Design Coherence

| Decision | Implemented as designed? | Note |
|---|---|---|
| D1 ambient Proxy for Better Auth | Yes | `src/shared/db/ambient.ts`; throws without context, no unscoped fallback |
| D2 subdomain bootstrap in middleware every request | Yes | `src/middleware.ts:80-93`; replay guard verified at runtime |
| D3 tenant RLS-exempt, column-narrow grant | Yes | migration lines 40-41; runtime-asserted in `harness-smoke.test.ts` |
| D4 composite uniqueness, no bare unique | Yes | schema 43-44, 56-57; DDL indexes confirmed |
| D5 set_config(..., TRUE) parameterized | Yes | `scoped.ts:41-42, 79-80`; no string interpolation |
| D6 array-form transaction in allOperations | Yes | `scoped.ts:39-46` |
| D7 nickname -> email inside scoped tx, no username plugin | Yes | `sign-in.action.ts:86-97` |
| D8 single AsyncLocalStorage shared by db + logging | Yes | `request-context.ts` consumed by `ambient.ts` and `logger.ts` |
| D9 ephemeral Neon branch per run via provide/inject | Yes | `neon-global-setup.ts` + `tests/setup/env.ts` |
| D10 split DATABASE_URL / DIRECT_DATABASE_URL | Yes | `env.ts` app-pooled only; owner URL CLI-only |
| D11 isActive rejected in session.create.before | Yes | `auth.ts:61-88` - but its distinct APIError is what leaks through the public route (CRITICAL-1) |
| Bootstrap = exactly one named flow | **No** | second flow added - see W3 |
| Transaction timeouts | Deviation, documented | TRANSACTION_OPTIONS widened to maxWait 10s / timeout 20s for Neon cold start |
| E2E against preview deploy | Deviation, documented | local `next build && next start` - no remote/CI exists; `docs/e2e-testing.md` |

---

## 7. Verifier-Confirmed Claims (re-checked, not taken on faith)

1. **FORCE ROW LEVEL SECURITY really is in the migration** -
   `prisma/migrations/20260803061701_rls_roles/migration.sql:24`, and it is asserted at runtime through
   `pg_class.relforcerowsecurity` rather than only inspected statically.
2. **Fail-closed is real, not assumed** - an app-role connection with no `app.tenant_id` returns
   **0 rows**, not all rows (`harness-smoke.test.ts:99-125`, `db-rls-fail-closed.test.ts:44-53`), and
   WITH CHECK rejects a cross-tenant INSERT with a real Postgres RLS error.
3. **No raw prisma model access outside `src/shared/db`** - independent grep: the generated client is
   imported only by `src/shared/db/{client,scoped,types}.ts`; the only `base.<model>` calls are
   `bootstrap.ts:24` and `bootstrap.ts:44`, both inside the wrapper.
4. **Cross-tenant session replay -> 401** - `src/middleware.ts:59-74` verified, including the
   `findSessionTenantByToken` deviation and the `lastIndexOf(".")` signed-cookie split; proven at runtime
   with a genuinely signed Better Auth cookie replayed against the wrong host.
5. **Both claimed bugfixes are actually present on `dev`** - `runtime: "nodejs"` at
   `src/middleware.ts:108` (commit `b077ef4`); `returnHeaders: true` + `setCookie` at
   `sign-in.action.ts:127-136` with real `cookies().set()` forwarding in
   `submit-sign-in.action.ts:64-69` (commit `7ade22b`).
6. **Scope discipline holds** - `src/modules/` contains only `auth`. No `patients`, `orders`, or any other
   module exists. No out-of-scope files found.
7. **Task completion is honest** - all 32/32 tasks in `tasks.md` are `[x]`, and every one maps to code that
   actually exists on `dev`. No task is checked without a corresponding artifact.

---

## 8. Task Completeness

| Phase | Tasks | Complete | Verified against code |
|---|---|---|---|
| 1 Scaffolding & Config | 5 | 5 | Yes |
| 2 Schema & RLS Migrations | 4 | 4 | Yes |
| 3 Neon Test Harness | 4 | 4 | Yes |
| 4 Platform Foundation | 4 | 4 | Yes (but W1/W2 - built, not wired) |
| 5 Tenant Isolation Wrapper | 5 | 5 | Yes |
| 6 Better Auth Sign-In | 7 | 7 | Yes (6.7 incomplete against AC-4 - CRITICAL-1) |
| 7 E2E & Cleanup | 3 | 3 | Yes (7.3 documented-only, as scoped) |
| **Total** | **32** | **32** | No unchecked tasks; no false checkmarks |

Task completeness is not the blocker. Spec correctness is.

---

## 9. Verdict and Required Actions

**FAIL** - do not archive.

Blocking before `sdd-archive`:
1. **CRITICAL-1** - close the AC-4 account-state oracle on `POST /api/auth/sign-in/email`, and add
   failure-path coverage to `auth-route-mount.test.ts` (W6) so it cannot regress.
2. **CRITICAL-2 / CRITICAL-3** - add the two duplicate-within-tenant uniqueness rejection tests.

Strongly recommended in the same pass:
3. **W3** - amend `specs/tenant-isolation/spec.md` to name `findSessionTenantByToken` as an authorized
   second bootstrap flow (closing the proposal Open Decision 1), or refactor it out.
4. **W1 / W2** - either wire `toErrorResponse` and `logger` into the real request path, or narrow the
   platform-foundation spec to what Story 1.1 genuinely delivers. Do not leave requirements passing
   vacuously.

Deferrable: W4, W5, S1-S5.

**Verifier housekeeping**: a temporary probe test was created, executed, and deleted; the leaked Neon
branch `test-e2e-local-1786428090398` was deleted. `git status` is clean apart from this report.
No source, test, or task file was modified by verification.
