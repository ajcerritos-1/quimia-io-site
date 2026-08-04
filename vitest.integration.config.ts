import { defineConfig } from "vitest/config";

/**
 * Integration-test project — wires the ephemeral Neon-branch harness (D9,
 * AD-9). Every file under `tests/integration/**` runs against a real
 * Postgres branch created fresh for this run and torn down afterward; see
 * `tests/setup/neon-global-setup.ts`. No mocked Prisma client may be
 * substituted here (tenant-isolation spec, "A mocked Prisma client is
 * rejected as RLS evidence").
 *
 * Run via `npm run test:integration`. Requires `NEON_API_KEY`,
 * `NEON_PROJECT_ID`, `NEON_PARENT_BRANCH_ID` in the environment (see
 * `.env.example`).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/setup/neon-global-setup.ts"],
    setupFiles: ["tests/setup/env.ts"],
    // Branch creation + migrate deploy + provisioning is a real network
    // round-trip to Neon's control plane; give it more room than the 10s
    // unit-test default before Vitest reports a hang.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
