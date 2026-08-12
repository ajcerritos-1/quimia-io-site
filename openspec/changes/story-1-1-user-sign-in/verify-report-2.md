# Verification Report #2 (re-verify): story-1-1-user-sign-in

**Change**: `story-1-1-user-sign-in`
**Branch verified**: `dev` (HEAD `5996d04`, working tree clean at start and at end)
**Mode**: Full spec-driven re-verification (proposal + 3 specs + design + tasks + apply-progress)
**Strict TDD**: ACTIVE
**Verifier context**: fresh/adversarial second independent pass. Every claim in the PR 5
apply-progress was treated as a claim, not a fact, and re-derived from source plus runtime.
**Predecessor**: `verify-report.md` (FAIL - 3 CRITICAL, 6 WARNING, 5 SUGGESTION). That file is
preserved unchanged as the historical record; this report does not supersede its findings, it
records their disposition.
**Date**: 2026-08-11

**VERDICT: PASS WITH WARNINGS** - 0 CRITICAL, 2 WARNING (both pre-existing, explicitly deferred,
harness-only), 8 SUGGESTION (5 pre-existing + 3 new, all non-blocking).
**The change is READY for `sdd-archive`.**

---

## 1. Disposition of the Original FAIL Findings

| Finding | Claimed by PR 5 | Verifier disposition | Evidence class |
|---|---|---|---|
| CRITICAL-1 - AC-4 account-state oracle on `POST /api/auth/sign-in/email` | Fixed | **RESOLVED** | Independent runtime probe against a real Neon branch |
| CRITICAL-2 - duplicate email within tenant UNTESTED | Fixed | **RESOLVED** | Test source read + real Postgres `23505` at runtime |
| CRITICAL-3 - duplicate nickname within tenant UNTESTED | Fixed | **RESOLVED** | Test source read + real Postgres `23505` at runtime |
| W3 - undisclosed second bootstrap flow | Fixed (spec amended) | **RESOLVED** | Spec text read; scope confirmed narrow |
| W1 - error envelope had zero production call sites | Fixed | **RESOLVED** | 3 real call sites + observed HTTP body |
| W2 - logger had zero production call sites | Fixed | **RESOLVED** | 5 real call sites + observed log lines in BOTH runtimes |
| W6 - `auth-route-mount.test.ts` had no failure-path coverage | Folded into CRITICAL-1 | **RESOLVED** | 2 new non-tautological failure-path tests |
| W4 - Windows Neon branch leak | Deferred | **STILL OPEN (as instructed)** | Reproduced, 2 leaks; verifier deleted them |
| W5 - no readiness poll before `migrate deploy` | Deferred | **STILL OPEN (as instructed)** | Reproduced, 2 of 7 harness startups |
| S1-S5 | Deferred | **STILL OPEN (as instructed)** | Confirmed untouched |

---

## 2. Test Evidence - Observed vs Claimed

All commands run by the verifier on `dev` @ `5996d04`. Exit codes captured without pipe masking.

| Command | PR 5 CLAIM | VERIFIER OBSERVED | Match |
|---|---|---|---|
| `npm run test` | 29/29 unit | **29 passed (29), 5 files, 747ms, exit 0** - first attempt | MATCHES |
| `npm run test:integration` | 34/34 across 9 files | **34 passed (34), 9 files, 80.78s, exit 0** - first attempt, no W5 flake | MATCHES |
| `npx playwright test` | 3/3 e2e | **3 passed (59.1s), exit 0** - first attempt | MATCHES |
| `npx tsc --noEmit` | clean | **exit 0**, no diagnostics | MATCHES |
| `npx eslint .` | clean | **exit 0**, no findings | MATCHES |

Integration count went 30 to 34 exactly as claimed: +2 CRITICAL-1 failure-path tests in
`auth-route-mount.test.ts`, +2 CRITICAL-2/3 uniqueness-rejection tests in `auth-sign-in.test.ts`.
No test was deleted, weakened, or skipped to reach the number (diff inspected).

---

## 3. Per-Finding Re-Verification

### CRITICAL-1 - **RESOLVED (empirically confirmed)**

**Implementation read**: `src/app/api/auth/[...all]/route.ts` now defines `normalizeAuthFailure(response)`
(line 37). It short-circuits on any status other than 401, and for 401 discards Better Auth's own body
entirely, re-emitting `toErrorResponse(new AppError(AUTH_INVALID_CREDENTIALS.code, ..., {status: 401}))`
via `Response.json(...)`. Both `GET` and `POST` route through `handle()` (line 48), which returns
`normalizeAuthFailure(response)` - so there is no unnormalized escape path from this file.

**Independent runtime probe** (created, executed, deleted; working tree left clean). A temporary
integration test hit the real mounted `POST` export against a real ephemeral Neon branch with real
scrypt-hashed accounts, and dumped raw `text()` bodies with no expected shape asserted first:

```json
{
  "wrongPassword":    { "status": 401, "contentType": "application/json", "setCookieCount": 0,
    "rawBody": "{\"error\":{\"code\":\"AUTH_INVALID_CREDENTIALS\",\"message\":\"Invalid credentials.\"}}" },
  "unknownEmail":     { "status": 401, "contentType": "application/json", "setCookieCount": 0,
    "rawBody": "{\"error\":{\"code\":\"AUTH_INVALID_CREDENTIALS\",\"message\":\"Invalid credentials.\"}}" },
  "inactiveUser":     { "status": 401, "contentType": "application/json", "setCookieCount": 0,
    "rawBody": "{\"error\":{\"code\":\"AUTH_INVALID_CREDENTIALS\",\"message\":\"Invalid credentials.\"}}" },
  "unresolvedTenant": { "status": 401, "contentType": "application/json", "setCookieCount": 0,
    "rawBody": "{\"error\":{\"code\":\"AUTH_INVALID_CREDENTIALS\",\"message\":\"Invalid credentials.\"}}" }
}
```

Byte-for-byte identical `rawBody` across all four failure modes - including key order - plus identical
status, identical `content-type`, and zero `Set-Cookie` headers on every one. This is a direct,
side-by-side refutation of the original report's reproduction, which showed
`{"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}` for wrong-password against
`{"code":"AUTH_INVALID_CREDENTIALS","message":"Invalid credentials."}` for inactive-user. The
account-state oracle is closed. The probe also covers a case the fix batch did not claim: an
`unresolved` tenant header, which now also collapses to the identical body.

**Are the new tests real or tautological?** Real. `auth-route-mount.test.ts:131` seeds two independent
tenants - one active user given a wrong password, one genuinely `isActive: false` user given the
CORRECT password (so the D11 hook is the thing that fires, not a password mismatch) - and asserts
against a hardcoded literal `AC4_GENERIC_ENVELOPE`, not against the other response. It then also
asserts `JSON.stringify(a) === JSON.stringify(b)`, which catches key-order drift that `toEqual` would
miss. Line 167 adds a third distinct failure mode (unknown email) against the same literal. Nothing in
the assertions is derived from the implementation, so none of it can pass vacuously. The 200 happy-path
test at line 83 still asserts a real `Set-Cookie` and the real `userId`, so the fix demonstrably did not
turn every response into a 401.

**Scope of the fix**: `normalizeAuthFailure` blankets all 401s from this route rather than branching on
sub-path. Verified as currently correct: `auth.ts` enables only `emailAndPassword` with no plugins, so
the only 401s this handler can emit are credential failures, and `get-session` without a cookie returns
200 + null (asserted at line 109). See S6 for the forward-looking guardrail.

### CRITICAL-2 - **RESOLVED (empirically confirmed)**

`tests/integration/auth-sign-in.test.ts:214`. Source read, not just the pass count. The test seeds a
real tenant, inserts a user with a random email, then attempts a second raw `INSERT` through the owner
`pg.Client` with the same email and asserts `rejects.toMatchObject({ code: "23505" })` - a genuine
Postgres unique-violation SQLSTATE from a real Neon branch, propagated by the `pg` driver. There is no
mock, no stub, and no Prisma indirection that could fake it. The user id and nickname are freshly
randomized per call, so `user_tenantId_email_key` is the only constraint that can fire. Ran green in
the 34/34 integration run.

### CRITICAL-3 - **RESOLVED (empirically confirmed)**

`tests/integration/auth-sign-in.test.ts:227`. Same technique, mirrored: the duplicate is on `nickname`
while the email is deliberately left random ("Different email so only the `(tenantId, nickname)`
composite index is exercised"), which correctly isolates `user_tenantId_nickname_key` from the email
constraint the previous test exercises. Real `23505`, real branch, ran green.

Both scenarios move from UNTESTED to PASS in the compliance matrix.

### W3 - **RESOLVED**

`openspec/changes/story-1-1-user-sign-in/specs/tenant-isolation/spec.md:28-45`. The requirement was
rewritten from one named flow to exactly two, and the added scenario "Cross-tenant session-replay
bootstrap lookup is narrowly scoped" is genuinely narrow, not a blanket widening:

- THEN it queries only `session.tenantId`, by `token`, from the RLS-exempt `session` table - no other
  column, no `user` join
- AND the caller (middleware) uses the result only to compare `session.tenantId` against the resolved
  subdomain tenant and reject a mismatch; no other use of this read is authorized
- the requirement retains its closing constraint: no third flow may be added without amending it

Cross-checked against the implementation: `bootstrap.findSessionTenantByToken` is called from exactly
one place (`src/middleware.ts:69`) and its result is used for exactly one comparison (line 70). Spec
now matches code, at the same narrowness, and the proposal's Open Decision 1 is closed. Nothing was
broadened beyond what the code actually does.

### W1 - **RESOLVED**

`toErrorResponse` now has three real production call sites (grep across `src/` excluding `*.test.ts`):

- `src/middleware.ts:76` - the cross-tenant-replay 401 body, previously hand-rolled
- `src/app/api/auth/[...all]/route.ts:40` - every 401 from the mounted Better Auth handler
- `src/modules/auth/server/sign-in.action.ts:87` - `genericFailure()`

More importantly, the requirement is now demonstrated by an actual HTTP response body, not only by
`errors.test.ts`: the probe above observed `{"error":{"code":...,"message":...}}` coming off the wire
from the public auth route. That is the exact contradiction the original W1 raised ("the public auth
route returns Better Auth un-enveloped top-level `{code, message}`"), and it no longer holds. The
requirement is no longer vacuous. One nuance recorded as S7.

### W2 - **RESOLVED (reproduced independently, in BOTH runtimes)**

`logger` now has five real production call sites: `middleware.ts:106`, and
`sign-in.action.ts:126,141,155,171`. The apply-progress's captured-lines claim was NOT taken on faith -
it was reproduced twice, from two different runtimes.

**(a) Integration run** (plain Node, no bundler), captured from the verifier's own
`npm run test:integration` stdout:

```
{"level":30,"time":1786497331977,...,"request_id":"req-4154b506-...","tenant_id":"tenant-signin-646ec8b0-...","userId":"user-signin-12fd27c7-...","msg":"sign-in succeeded"}
{"level":40,...,"request_id":"req-f1b3c006-...","tenant_id":"tenant-signin-91cfbfc2-...","reason":"invalid_credentials","msg":"sign-in failed"}
{"level":40,...,"request_id":"req-58524f0a-...","tenant_id":"unknown","reason":"unknown_or_inactive_tenant","msg":"sign-in failed"}
{"level":30,...,"request_id":"421b237a-...","tenant_id":"tenant-replay-67a023e1-...","slug":"lab-replay-...","msg":"tenant bootstrap resolved"}
```

**(b) Real built Next.js server** (`next build && next start`, via the Playwright harness). This is the
stronger evidence and it was NOT part of the fix batch's claim. Note that Playwright's `webServer`
defaults to `stdout: "ignore"`, so a plain `npx playwright test` shows only stderr and pino appears to
be silent - a harness capture artifact, not a logging defect. The verifier temporarily set
`stdout: "pipe"`, re-ran, then reverted the config (`git checkout --`, tree clean). Result: 11
structured lines, correctly correlated across the middleware to Server Action header bridge (note the
same `request_id` `3b733d71` on both of the first two lines):

```
{"level":30,...,"request_id":"3b733d71-...","tenant_id":"tenant-e2e-21e6ac9e-...","slug":"lab-e2e-e3b982a1","msg":"tenant bootstrap resolved"}
{"level":30,...,"request_id":"3b733d71-...","tenant_id":"tenant-e2e-21e6ac9e-...","userId":"user-e2e-2edfa7d5-...","msg":"sign-in succeeded"}
{"level":40,...,"request_id":"eea162f2-...","tenant_id":"tenant-e2e-b9657bfb-...","reason":"invalid_credentials","msg":"sign-in failed"}
{"level":30,...,"request_id":"4813d8de-...","tenant_id":"unresolved","slug":null,"msg":"tenant bootstrap unresolved"}
```

Every line is structured JSON and every line carries both `tenant_id` and `request_id`, including the
degenerate cases (`"unknown"`, `"unresolved"`) - exactly what `logger.ts`'s `mixin` promises. The
platform-foundation requirement "Every log line MUST be structured JSON and MUST carry `tenant_id` and
`request_id`" is now satisfied by real emitted output in the real runtime, not by an empty set. The
proposal success criterion is demonstrated.

---

## 4. Regression Check - the previously-compliant paths

| Path | Status | Evidence |
|---|---|---|
| UI sign-in happy path (`signIn()` to real browser session) | **No regression** | e2e test 1 green on first attempt in both e2e runs; real `Set-Cookie` established |
| UI generic-failure rendering (AC-4, wrong password) | **No regression** | e2e test 2 green; single generic message, no field hint |
| UI byte-for-byte inactive-account message (D11) | **No regression** | e2e test 3 green |
| `signIn()` generic-failure object contract | **No regression** | all 7 `auth-sign-in.test.ts` AC-4 tests still assert `toEqual(GENERIC_FAILURE)` and pass; `SignInFailure`'s `{ok, code, message}` shape is unchanged - `genericFailure()` unwraps the envelope back into the same three fields |
| Cross-tenant session replay to 401 | **No regression** | `auth-cross-tenant-session-replay.test.ts` green; it asserts the exact `{error:{code,message}}` body, which the `AppError`/`toErrorResponse` refactor preserved |
| Mounted route happy path + `get-session` to null | **No regression** | `auth-route-mount.test.ts` lines 83/109 green - the 401 normalization does not touch non-401 responses |

The `normalizeAuthFailure` change cannot affect the UI path by construction: `signIn()` calls
`auth.api.signInEmail` as an in-process function, never `auth.handler(request)`, so it never traverses
the route file at all.

---

## 5. Scope Check

`git diff --stat 6940812..5996d04` - exactly the 7 files the apply-progress claimed, nothing more:

```
 .../specs/tenant-isolation/spec.md               | 10 ++-
 openspec/changes/story-1-1-user-sign-in/tasks.md | 24 ++++++
 src/app/api/auth/[...all]/route.ts               | 34 +++++++-
 src/middleware.ts                                | 27 ++++++-
 src/modules/auth/server/sign-in.action.ts        | 30 ++++++-
 tests/integration/auth-route-mount.test.ts       | 93 +++++++++++++++++++++-
 tests/integration/auth-sign-in.test.ts           | 32 +++++++-
 7 files changed, 238 insertions(+), 12 deletions(-)
```

- 250 changed lines - comfortably under the 400-line review budget; no `size:exception` needed.
- No schema, no migration, no harness file touched. `scripts/e2e/start-server.ts`,
  `tests/setup/neon-global-setup.ts`, the ESLint flat config, `src/shared/db/bootstrap.ts` and `docs/`
  are all absent from the diff - so W4, W5, S2, S3 and S4 were correctly left alone, neither silently
  "fixed" nor newly broken.
- `src/modules/` still contains only `auth`. No out-of-scope module appeared.
- `tasks.md` gained a clearly-labelled "PR 5 Addendum" section rather than new fake numbered tasks;
  32/32 original tasks remain `[x]`, 0 unchecked.
- `_bmad-output/` and `sprint-status.yaml` were untouched by the fix batch and untouched by verification.

---

## 6. Spec Compliance Matrix (deltas from report #1 in bold)

### `auth-sign-in`

| Requirement | Scenario | Evidence | Status |
|---|---|---|---|
| Credential sign-in to tenant-scoped session | Successful sign-in | `auth-sign-in.test.ts`, `auth-route-mount.test.ts:83`, e2e happy path | PASS |
| Credential sign-in to tenant-scoped session | Tenant resolution precedes session | `db-bootstrap.test.ts`, replay test, e2e | PASS |
| Generic auth failure | Invalid password | `auth-sign-in.test.ts` + **`auth-route-mount.test.ts:131`** + e2e | PASS |
| Generic auth failure | Inactive account byte-for-byte identical | `signIn()` path + **mounted-route path, verifier probe: identical raw bodies** | **PASS (was FAIL / CRITICAL-1)** |
| Multi-tenant uniqueness | Same email across two tenants | `auth-sign-in.test.ts:183` | PASS |
| Multi-tenant uniqueness | Duplicate email within tenant rejected | **`auth-sign-in.test.ts:214`, real Postgres `23505`** | **PASS (was UNTESTED / CRITICAL-2)** |
| Multi-tenant uniqueness | Duplicate nickname within tenant rejected | **`auth-sign-in.test.ts:227`, real Postgres `23505`** | **PASS (was UNTESTED / CRITICAL-3)** |

### `tenant-isolation`

Unchanged from report #1 - all scenarios PASS - except that the "Bootstrap mode narrowly scoped" row no
longer carries the W3 caveat, and the newly-added scenario "Cross-tenant session-replay bootstrap
lookup is narrowly scoped" is covered at runtime by `auth-cross-tenant-session-replay.test.ts` and
`db-bootstrap.test.ts`. **PASS.**

### `platform-foundation`

| Requirement | Scenario | Evidence | Status |
|---|---|---|---|
| Typed env configuration | Zod-validated, no raw `process.env` in business logic | `env.test.ts`; grep confirms the single read in `env.ts:49` | PASS |
| Typed env configuration | Env loaded before Prisma instantiation | no P1010 across 34 integration + 3 e2e runs | PASS (runtime evidence) |
| Structured JSON logging | Every log line carries `tenant_id` / `request_id` | **5 production call sites; 11 real lines captured from the built Next.js server, 9 from the integration run - all structured, all carrying both keys** | **PASS (was PASS-VACUOUS / W2)** |
| Single API error envelope | API errors return `{error:{code,message,details?}}` | **3 production call sites; observed on the wire from the public auth route and the middleware 401** | **PASS (was PASS-VACUOUS + contradicted / W1)** |

---

## 7. Design Coherence

Unchanged from report #1 with two corrections:

- **D11** - its distinct `APIError` no longer leaks through the public route; it is normalized at the
  route boundary. The hook itself is untouched, so the "never persist a session row for an inactive
  user" property is preserved.
- **"Bootstrap = exactly one named flow"** - was `No` (drift). Now `Yes, as amended`: the spec
  authorizes exactly two named flows and the code implements exactly two.

All other rows (D1-D10, transaction timeouts, e2e-against-local deviation) re-confirmed as in report #1.

---

## 8. WARNING Findings (both pre-existing and explicitly deferred)

### W4 - Windows Neon branch leak on e2e teardown - **STILL OPEN (deferred, reproduced)**

Both of the verifier's successful `npx playwright test` runs leaked one branch each
(`test-e2e-local-1786497537551` / `br-fancy-tree-axpauinp`, and `test-e2e-local-1786497672608` /
`br-purple-fog-axmzrztk`). Both were deleted by the verifier; the Neon project is back to `production`
only. Refinement worth recording: the leak is specific to `scripts/e2e/start-server.ts`. The Vitest
`neon-global-setup.ts` teardown is clean - four successful integration/probe runs this session leaked
zero branches. That narrows the eventual fix (task 7.3) to the e2e harness alone. Unchanged severity:
one free-tier concurrent-branch slot per local e2e run on Windows. Does not block archive.

### W5 - No endpoint-readiness poll before `prisma migrate deploy` - **STILL OPEN (deferred, reproduced)**

Observed 2 hard failures across 7 harness startups (~29%) this session - one on an integration-config
run and one on an e2e run - both the same `P1001: Can't reach database server at ep-*.neon.tech:5432`
immediately after branch creation, both passing unchanged on retry. Affects
`scripts/e2e/start-server.ts:115` and `tests/setup/neon-global-setup.ts:117` identically. This is a
false-red generator, not a product defect. Does not block archive, but it will bite the moment this
runs in CI without a retry policy.

Neither warning is in product code. Both are test-harness ergonomics, both were explicitly scoped out
of the PR 5 batch, and neither can affect a shipped artifact.

---

## 9. SUGGESTION Findings

Carried over unchanged from report #1 (all confirmed still present, all correctly untouched):

- **S1** - `next build` still emits `The "middleware" file convention is deprecated. Please use "proxy"
  instead.` (observed again this run). The `runtime: "nodejs"` fix must survive any eventual migration.
- **S2** - stale "against a real next dev server" doc comments in `tests/e2e/sign-in.spec.ts:4` and
  `scripts/e2e/start-server.ts:8`.
- **S3** - the ESLint DB boundary restricts `**/generated/prisma` only; `@prisma/client` and a raw `pg`
  Client remain importable from any app module.
- **S4** - `resolveTenantBySlug` returns tenants regardless of `isActive`, so `middleware.ts:117` sets
  `x-tenant-id` for a deactivated lab. Sign-in still rejects it correctly, but non-sign-in routes would
  open scoped context. The PR 5 apply-progress independently re-confirmed this. Decide before the
  Story 1.5 app shell.
- **S5** - `pg-connection-string` SSL-mode deprecation warnings on every DB-touching run; pin
  `sslmode=verify-full`.

New, introduced by or observed during the PR 5 fix (all minor):

- **S6** - `normalizeAuthFailure` blankets every 401 from `/api/auth/[...all]` into
  `AUTH_INVALID_CREDENTIALS`. That is correct today because `auth.ts` enables only `emailAndPassword`
  with no plugins, so every possible 401 there is a credential failure - and the route's own header
  comment says exactly that. But it is a latent trap: the day someone enables password reset, email
  verification, or a Better Auth plugin, a legitimately different 401 (expired reset token, unverified
  email) will be silently mislabelled as bad credentials, and no test will fail. Consider a guardrail -
  a test asserting the enabled endpoint surface, or narrowing the normalization to the `sign-in/*`
  sub-paths.
- **S7** - `genericFailure()` in `sign-in.action.ts:86` calls `toErrorResponse(...)` and then
  immediately unwraps the envelope back into `{ok, code, message}`. It satisfies "the helper has a
  production call site" more than it satisfies "this API error response uses the envelope" - a Server
  Action result is not an HTTP error body. This is harmless and the shape is unchanged and tested, but
  W1's real substance is carried by `middleware.ts:76` and `route.ts:40`, not by this one. If the
  indirection ever reads as noise, reverting just this call site would not reopen W1.
- **S8** - the two new uniqueness tests assert `{ code: "23505" }` but not which constraint fired.
  The seeding randomizes every other unique column, so today only the intended index can violate;
  adding `constraint: "user_tenantId_email_key"` / `"user_tenantId_nickname_key"` to the
  `toMatchObject` would make that reasoning explicit instead of implicit.
- **S9** (documentation, near-zero cost) - `playwright.config.ts`'s `webServer` block inherits
  Playwright's default `stdout: "ignore"`, which makes the app's pino output invisible during e2e and
  cost this verifier a false alarm. A one-line comment (or `stdout: "pipe"`) would save the next person
  the same detour.

---

## 10. Task Completeness

| Phase | Tasks | Complete | Verified against code |
|---|---|---|---|
| 1 Scaffolding & Config | 5 | 5 | Yes |
| 2 Schema & RLS Migrations | 4 | 4 | Yes |
| 3 Neon Test Harness | 4 | 4 | Yes |
| 4 Platform Foundation | 4 | 4 | **Yes - now wired, no longer built-but-unused** |
| 5 Tenant Isolation Wrapper | 5 | 5 | Yes |
| 6 Better Auth Sign-In | 7 | 7 | **Yes - 6.7 now complete against AC-4** |
| 7 E2E & Cleanup | 3 | 3 | Yes (7.3 documented-only, as scoped) |
| **Total** | **32** | **32** | No unchecked tasks; no false checkmarks |

Plus the PR 5 Addendum section, which claims no new task numbers and accurately describes what landed.

---

## 11. Verdict

**PASS WITH WARNINGS. The change is ready for `sdd-archive`.**

- All 3 CRITICAL findings from report #1 are RESOLVED and empirically confirmed - not accepted on the
  fix batch's word. CRITICAL-1 in particular was re-reproduced from scratch with an independent probe
  that dumped raw response bytes before asserting anything, and the result is the exact inverse of the
  original oracle.
- W3, W1 and W2 are RESOLVED. W1 and W2 moved from vacuous to genuinely demonstrated, and W2's evidence
  is stronger than what was claimed: real structured lines from the actual production build,
  correlated end-to-end by `request_id`.
- The two remaining WARNINGs (W4, W5) are pre-existing, explicitly deferred, live entirely in the test
  harness, and cannot affect shipped behavior. They are archive-compatible follow-ups, not blockers.
- No new CRITICAL was introduced. The four new SUGGESTIONs are latent-trap and hygiene notes, not
  defects.
- Scope discipline held exactly: 7 files, 250 lines, nothing outside the assigned remit, nothing
  deferred was silently touched.

Recommended follow-up (post-archive, not blocking): W5 first - it is a CI blocker waiting to happen -
then W4, then S6.

**Verifier housekeeping**: one temporary probe test was created, executed and deleted;
`playwright.config.ts` was temporarily patched for stdout capture and reverted via `git checkout --`;
two leaked Neon branches were deleted, leaving `production` as the only branch. `git status` is clean
apart from this report. No source, test, spec, or task file was modified by verification.
