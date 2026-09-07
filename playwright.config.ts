import { defineConfig } from "@playwright/test";

/**
 * Phase 7 e2e config. `webServer` runs `scripts/e2e/start-server.ts`,
 * which creates its own ephemeral Neon branch, migrates + provisions it,
 * runs a production build, then starts a real `next start` server against
 * it — see `docs/e2e-testing.md` for why this replaces design.md's
 * original "Playwright against a preview deploy" plan (no preview
 * pipeline exists yet), why it's `next build && next start` rather than
 * `next dev` (Turbopack's dev-mode first-request compile was empirically
 * too slow for this route's dependency graph), and why branch creation
 * lives in the webServer command itself rather than a separate
 * `globalSetup` (a `globalSetup`-based design deadlocks against this
 * Playwright version's own task ordering — see
 * `scripts/e2e/start-server.ts`'s header comment).
 *
 * Tenant subdomains resolve via `{lab}.localhost:{port}` (the same local
 * dev convention `src/shared/http/subdomain.ts` already supports) —
 * Chromium resolves any `*.localhost` hostname to loopback natively, no
 * hosts-file entry needed.
 */
const PORT = process.env.E2E_PORT ?? "3100";
const BASE_URL = `http://localhost:${PORT}`;
// Readiness/reuse probe. MUST be a URL that returns <404: `/sign-in`
// responds 200 regardless of tenant, so it is the stable probe. (The bare
// root `http://localhost:3100/` used to 404 via the tenant middleware when
// the shell home lived at `/`; the public landing page now serves it 200
// for any host, but READY_URL stays on `/sign-in` — unchanged, deliberate.)
const READY_URL = `http://localhost:${PORT}/sign-in`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  // `scripts/e2e/start-server.ts` runs a production build before serving
  // (see that file's header comment for why `next dev` was dropped), so
  // requests are served from already-compiled code — no first-request
  // compile latency to absorb here. Still generous over the default 5s/30s:
  // the request chain (middleware's tenant resolution + the sign-in Server
  // Action's own tenant re-resolution + scoped-tx nickname lookup + Better
  // Auth's own queries) hits a freshly-created, freshly-pooled Neon
  // connection — the same cold-start latency PR 4a's own `scoped.ts`
  // widened `$transaction`'s `maxWait`/`timeout` for (see that file's own
  // comment).
  // Test-level timeout widened 30s → 60s (2026-09-06, e2e gate evidence):
  // the binding wall on a cold Neon pool is the Server-Action promise never
  // settling within the test timeout — the shared sign-in/role-change
  // actions intermittently stall past 30s while Neon cold-starts its pool.
  // `expect.timeout` (25s) absorbs assertion latency; 60s absorbs the
  // action-level stall without masking real regressions (a hung action
  // still fails deterministically at 60s).
  timeout: 60_000,
  // Widened from 10s (2026-09-06): the sign-in chain (middleware tenant
  // resolution + sign-in Server Action re-resolution + scoped-tx lookup +
  // Better Auth queries) against a freshly-created, freshly-pooled Neon
  // branch intermittently exceeds 10s on cold start — proven by e2e runs
  // where `toHaveURL(/\/inicio$/)` resolved ~200ms after the window closed.
  // 25s absorbs the cold-start spike without masking real regressions.
  expect: { timeout: 25_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Future-proof gate (2026-09-06 review): a committed `test.only` must
  // never pass CI silently — Playwright errors on it whenever CI is set.
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx tsx scripts/e2e/start-server.ts",
    url: READY_URL,
    env: { E2E_PORT: PORT },
    // Opt-in attach mode (2026-08-24 workaround): on this Windows dev
    // machine, Playwright's own process spawn of `start-server.ts` hangs
    // (see deferred-work.md "Windows Playwright hang"). Set
    // E2E_REUSE_SERVER=1 to attach to a server you started manually with
    // `npx tsx scripts/e2e/start-server.ts`. Normally false on purpose —
    // a stray process on :3100 must NOT silently skip the fresh-branch
    // harness (branch create + migrate + build) and produce stale results.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    // Branch create + migrate deploy + provision-app-role + `next build`
    // + `next start`, all sequential, all before the URL becomes
    // reachable — generous headroom over the ~60-90s the equivalent
    // Vitest harness setup takes, plus a full production build.
    timeout: 360_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
