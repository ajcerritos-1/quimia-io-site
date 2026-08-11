/**
 * Shared connection-info contract between `scripts/e2e/start-server.ts`
 * (writer — the Playwright `webServer.command` entry point, which creates
 * the ephemeral Neon branch) and `tests/e2e/seed.ts` (reader — used by
 * spec files to seed tenants/users against the SAME branch the running
 * server is pointed at). See `docs/e2e-testing.md` for why branch creation
 * lives in the webServer command itself rather than a separate Playwright
 * `globalSetup` file (a `globalSetup`-based design deadlocks against this
 * Playwright version's own task ordering).
 */
import path from "node:path";

export const E2E_DB_INFO_PATH = path.join(__dirname, ".e2e-db.json");

export interface E2eDbInfo {
  appDatabaseUrl: string;
  ownerDatabaseUrl: string;
}
