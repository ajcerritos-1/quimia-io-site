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
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["tests/integration/**", "node_modules/**"],
  },
});
