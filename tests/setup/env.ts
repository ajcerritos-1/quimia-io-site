/**
 * Vitest `setupFiles` entry — runs IN each worker process, before any test
 * file (and therefore before any `src/shared/db` import, once that module
 * exists in Phase 5). `globalSetup` runs in a separate process, so its
 * `process.env` writes never reach here; `inject()` is the only supported
 * channel (D9, design.md "Test Infrastructure" gotchas).
 *
 * `loadEnvConfig()` loads `.env` into THIS (worker) process — design.md's
 * own P1010 mitigation table lists this file as one of the three callers
 * (alongside `prisma.config.ts` and `neon-global-setup.ts`) responsible for
 * loading env before anything reads `process.env`. Phase 4/5 never needed
 * it (their only env var, `DATABASE_URL`, is overridden by `inject()` right
 * below anyway); Phase 6 does, since `src/modules/auth/server/auth.ts`
 * reads `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`, which only exist in `.env`.
 *
 * Order matters: `loadEnvConfig()` must run BEFORE the `DATABASE_URL`
 * override below, or `.env`'s own (non-ephemeral) `DATABASE_URL` would win.
 */
import { loadEnvConfig } from "@next/env";
import { inject } from "vitest";

loadEnvConfig(process.cwd());

process.env.DATABASE_URL = inject("appDatabaseUrl");
