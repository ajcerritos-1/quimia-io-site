/**
 * Vitest `setupFiles` entry — runs IN each worker process, before any test
 * file (and therefore before any `src/shared/db` import, once that module
 * exists in Phase 5). `globalSetup` runs in a separate process, so its
 * `process.env` writes never reach here; `inject()` is the only supported
 * channel (D9, design.md "Test Infrastructure" gotchas).
 *
 * Only wired into the integration Vitest project (`vitest.integration.config.ts`)
 * — unit tests (Phase 4) have no DB dependency and never load this file.
 */
import { inject } from "vitest";

process.env.DATABASE_URL = inject("appDatabaseUrl");
