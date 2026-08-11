# E2E Testing (Phase 7) — Deviation from design.md

## What design.md says

design.md's "Test Infrastructure" table lists the E2E layer as:

> Sign-in happy path + invalid credentials | Playwright against a preview
> deploy

This assumed AD-9's preview pipeline — a Vercel preview deployment plus an
ephemeral Neon branch per pull request — would already exist by the time
Phase 7 landed.

## What actually exists

It does not. As of this batch (PR 4b):

- No git remote is configured on this repository.
- Nothing is connected to Vercel.
- No CI pipeline exists to build/deploy a preview on pull-request open.

Blocking Phase 7 on infrastructure this story never scoped (setting up a
Vercel project + git remote + CI is a platform/DevOps concern, not part of
Story 1.1's sign-in feature) is not the right tradeoff.

## What this batch does instead

Playwright runs against a **local** `next dev` server, pointed at its own
**ephemeral Neon branch** created specifically for the e2e run:

- `playwright.config.ts` — `webServer.command` is
  `npx tsx scripts/e2e/start-server.ts`.
- `scripts/e2e/start-server.ts` — creates a Neon branch, runs
  `prisma migrate deploy`, provisions the `quimia_app` role, writes
  connection info to `tests/e2e/.e2e-db.json` (gitignored, read by spec
  files for seeding), runs `next build`, THEN starts `next start -p 3100`
  with `DATABASE_URL` overridden to the ephemeral branch's app-role
  connection string. Installs best-effort `SIGTERM`/`SIGINT`/child-`exit`
  handlers that delete the branch on the way out.

  **`next build && next start`, not `next dev`.** The first implementation
  used `next dev`. Empirically, the very first `page.goto("/sign-in")`
  against Turbopack's dev-mode lazy compile-on-request never resolved
  within a 60-second test timeout — this route's full dependency graph
  (Base UI's `Field`/`Input` primitives, Better Auth's cookie utilities,
  the generated Prisma client, `shared/db`) is large enough that
  compile-on-first-request was simply too slow for a test budget. A
  production build compiles everything upfront, bounded by `webServer.
  timeout` (a one-time cost, not per-request), so every request the actual
  tests make is served from already-compiled code. This is a deliberate
  choice, not an oversight — see `scripts/e2e/start-server.ts`'s own
  header comment.
- `tests/setup/neon-branch-lib.ts` — the Neon API primitives
  (`neonApi`, `buildConnectionUri`, `requiredEnv`) both this harness and
  the Vitest integration harness (`tests/setup/neon-global-setup.ts`) share.
  Extracted from the Vitest harness, unchanged, specifically so this
  script could reuse the exact same branch-per-run mechanism instead of
  reinventing it (see the `refactor(test)` commit in this batch).

This is **not** the literal same Neon branch a `test:integration` run
creates — Playwright and Vitest are separate CLI invocations with no
shared process — it is the same harness *mechanism*, run for the e2e
suite's own lifetime, following the identical branch-per-run pattern
(AD-9, D9) design.md already established for integration tests.

### Why branch creation lives in the webServer command, not `globalSetup`

The first implementation attempt used a separate Playwright `globalSetup`
file that created the branch and wrote the connection-info file, paired
with a `webServer.command` that waited for that file. It deadlocked, and
did so silently (no error, no log — just a `webServer` timeout every run).

Reading `playwright/lib/runner/index.js`'s `createGlobalSetupTasks`
confirmed why: task order is `[removeOutputDirs, ...pluginSetupTasks
(webServer is one of these), ...globalTeardowns, ...globalSetups]` — the
webServer plugin's own `setup()` runs and blocks **before** any configured
`globalSetup` gets a turn. A `globalSetup` that only runs after webServer
already gave up can never satisfy a webServer command waiting on it — a
strict ordering dependency in the wrong direction. Verified empirically
with a trivial `globalSetup` stub that just wrote a marker file: the
marker was never written, confirming globalSetup genuinely never ran, not
just that its output wasn't visible.

The fix: move branch creation into the webServer command itself
(`scripts/e2e/start-server.ts`, run via `tsx`, reusing
`tests/setup/neon-branch-lib.ts`). Playwright then only waits for the
configured URL to become reachable, which happens once branch creation +
migrate + provision + `next dev` startup have all finished, in order, in
that one process — no cross-task ordering assumption needed.

### Cleanup caveat on Windows

Playwright's `WebServerPlugin` tears the webServer process down via
`gracefullyClose`; its `attemptToGracefullyClose` throws outright
("Graceful shutdown is not supported on Windows") whenever
`gracefulShutdown` isn't configured, which it isn't here — so on Windows,
teardown is closer to a forceful process-tree kill than a signal
`start-server.ts`'s own handlers are guaranteed to observe in time to await
the Neon `DELETE` call. Those handlers are still installed as best-effort
(they do fire on a normal `next dev` exit), but the scheduled cleanup job
`docs/neon-branch-cleanup.md` describes is the authoritative safety net
here — the same one already relied on for any other killed test run.

Tenant subdomains resolve the same way they do in local dev: navigating to
`http://{lab}.localhost:3100/sign-in`. Chromium resolves any `*.localhost`
hostname to loopback natively (no `/etc/hosts` entry, no DNS setup) — this
is the exact convention `src/shared/http/subdomain.ts` already documents
for local development.

## Why this is safe to defer, not skip

- The feature under test (credential sign-in, tenant resolution, generic
  failure messaging) is exercised end-to-end through a REAL browser, a
  REAL Next.js server, and a REAL Postgres database — nothing here is
  mocked. The only thing missing relative to design.md's original plan is
  *which* deployed instance Playwright points at (local dev server vs. a
  Vercel preview), not the fidelity of the test itself.
- Once AD-9's preview pipeline exists (git remote + Vercel project + CI),
  swapping `playwright.config.ts`'s `webServer`/`baseURL` for a preview
  deploy's URL is a config-only change — none of `tests/e2e/*.spec.ts`,
  `tests/e2e/seed.ts`, or the seeding pattern need to change, since they
  already treat "the running app" as a black box reached over HTTP.

## Running locally

```
npm run test:e2e
```

Requires the same `NEON_API_KEY` / `NEON_PROJECT_ID` / `NEON_PARENT_BRANCH_ID`
env vars the Vitest integration harness already needs (see `.env.example`).
