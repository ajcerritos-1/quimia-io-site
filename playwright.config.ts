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
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx tsx scripts/e2e/start-server.ts",
    url: BASE_URL,
    env: { E2E_PORT: PORT },
    reuseExistingServer: false,
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
