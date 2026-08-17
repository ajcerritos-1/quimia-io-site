import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit-test project — no DB, no Neon branch, no globalSetup. Fast RED-GREEN
 * loop for Phase 4 (env, request-context, logger, errors). Deliberately
 * separate from `vitest.integration.config.ts`, which wires the ephemeral
 * Neon-branch harness (D9) for tests that need a real Postgres connection
 * (tenant-isolation spec: "RLS Isolation MUST Be Verified Against a Real
 * Postgres Branch" — that requirement, and the cost of satisfying it, only
 * applies to the integration layer, not plain unit tests).
 */
export default defineConfig({
  resolve: {
    // `server-only` (Review Findings patch 2026-08-17) throws unconditionally
    // when imported outside Next.js's own webpack build, which is the ONLY
    // place its package.json's `react-server` export condition applies and
    // resolves it to a no-op instead. Vitest never sets that condition, so a
    // test importing any server-only-marked module (directly or transitively)
    // would otherwise fail with "This module cannot be imported from a
    // Client Component module." — aliasing straight to the package's own
    // `empty.js` (the same no-op Next.js itself resolves to) is the
    // package's documented test-runner workaround, not a hack around the
    // guard: the guard's job is blocking CLIENT bundles, not Node test runs.
    alias: {
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["tests/integration/**", "node_modules/**"],
  },
});
