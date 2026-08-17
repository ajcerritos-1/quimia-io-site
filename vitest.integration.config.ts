import { fileURLToPath } from "node:url";
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
  resolve: {
    // See `vitest.config.ts` for why `server-only` (Review Findings patch
    // 2026-08-17) needs this alias under Vitest — every integration test
    // here imports real server modules (`require-admin.ts`, `auth.ts`, ...)
    // directly, which now transitively import `server-only`.
    alias: {
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
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
    // Every file that imports `src/shared/db` builds its OWN PrismaClient
    // (and therefore its OWN pg connection pool) — Vitest isolates modules
    // per test file. All files share the SAME single ephemeral branch (D9:
    // branch-per-RUN, not per-file), so running files in parallel means
    // several independent pools + concurrent $transaction calls compete for
    // that one branch's (small, free-tier) connection budget. Running files
    // serially keeps the "one branch per run" design intact while avoiding
    // "Unable to start a transaction in the given time" / ECONNRESET under
    // contention (Phase 5 deviation — see apply-progress).
    fileParallelism: false,
  },
});
