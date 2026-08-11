# Neon Test-Branch Cleanup (AD-9 Deferred)

## Leak risk

Both test harnesses in this repo create an ephemeral Neon branch per run and
delete it in a teardown step:

- `tests/setup/neon-global-setup.ts` — Vitest `globalSetup`, used by
  `npm run test:integration`.
- `scripts/e2e/start-server.ts` — Playwright's `webServer.command`, used by
  `npm run test:e2e`.

Both name their branch `test-<runId>-<timestamp>` (Vitest) or
`test-e2e-<runId>-<timestamp>` (Playwright) and attempt to delete it on
their own way out.

The gap is wider for the Playwright harness specifically: Vitest's
`globalSetup` teardown reliably runs on both pass and fail (Vitest's own
runner guarantee). Playwright's webServer teardown, on Windows, is a
forceful process-tree kill rather than a graceful signal
(`docs/e2e-testing.md`'s "Cleanup caveat on Windows") — `start-server.ts`'s
own cleanup handlers are best-effort, not guaranteed. On top of that, any
**killed** run of either harness — `Ctrl+C`, a CI job cancellation, a
crashed runner, an OOM kill — never reaches its own teardown at all. Either
way, the branch created is never deleted and becomes orphaned against
Neon's project. On Neon's free tier, concurrent branches are capped;
enough orphaned `test-*` branches accumulate and eventually a real
(interactive, deliberate) run fails to create its own branch because the
cap is already exhausted.

This is the same risk design.md's own "Test Infrastructure" gotchas list
already named ("Add a scheduled CI job deleting `test-*` branches older
than 6h — killed runs leak branches into the free-tier cap") — this
document is that plan, written down, not yet wired to anything.

## Recommended cleanup mechanism

A scheduled job (cron-style — GitHub Actions `schedule:` trigger once CI
exists, or any external scheduler in the meantime) that:

1. Calls Neon's `GET /projects/{project_id}/branches` API.
2. Filters to branches whose `name` starts with `test-` (covers both
   harnesses' naming — `test-` and `test-e2e-` both match the same prefix).
3. Filters further to branches whose `created_at` is older than **6 hours**
   — comfortably longer than any single CI run of this repo's test suites
   should ever take, so it never touches a branch a run is still using.
4. Calls `DELETE /projects/{project_id}/branches/{branch_id}` for each
   match.
5. Never deletes the branch identified by `NEON_PARENT_BRANCH_ID` (the
   long-lived parent every ephemeral branch forks from) — the filter in
   step 2/3 already excludes it structurally, since the parent branch is
   not named `test-*`, but a real implementation should still assert this
   explicitly (belt-and-suspenders against a future naming collision).

## Scope of this document

This is a **plan**, not an implementation. No CI pipeline exists yet in
this repo (no git remote is configured, nothing is connected to a CI
provider) — wiring an actual scheduled job is out of scope for Phase 1 and
belongs to whichever change first sets up CI. When that lands, this
document is the spec for that job's cleanup logic; `neonApi`/`requiredEnv`
in `tests/setup/neon-branch-lib.ts` are already the right primitives to
build it on (same `Authorization: Bearer` + REST shape).
