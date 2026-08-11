#!/usr/bin/env tsx
/**
 * Playwright `webServer.command` entry point (Phase 7, AD-9, D9). Creates
 * its OWN ephemeral Neon branch for the e2e run, reusing the exact
 * primitives `tests/setup/neon-global-setup.ts` already uses for the
 * Vitest integration harness (`tests/setup/neon-branch-lib.ts`), runs
 * `prisma migrate deploy` + provisions the app role, writes connection
 * info for `tests/e2e/seed.ts` to read, THEN starts `next dev` pointed at
 * that branch's app-role connection string.
 *
 * This branch-creation logic lives INSIDE the webServer command itself —
 * deliberately NOT a separate Playwright `globalSetup` file. A globalSetup
 * design deadlocks: reading `playwright/lib/runner/index.js`'s
 * `createGlobalSetupTasks`, the webServer plugin's own setup task runs
 * BEFORE any configured `globalSetup` task. A globalSetup that writes a
 * connection-info file, paired with a webServer command that waits on that
 * file, never resolves — webServer's setup blocks (and eventually times
 * out) waiting for a file only globalSetup would write, but globalSetup
 * never gets a turn until AFTER webServer's setup has already failed and
 * aborted the whole run (confirmed empirically against this Playwright
 * version before landing on this design — see `docs/e2e-testing.md`).
 * Folding branch creation into the webServer command sidesteps the
 * ordering question entirely: Playwright just waits for the URL to become
 * reachable, which happens only once branch creation + migrate + provision
 * + `next dev` startup have ALL completed, in order, in this one process.
 *
 * Cleanup caveat (documented, not silently ignored): `docs/
 * neon-branch-cleanup.md` covers this. Playwright's `WebServerPlugin`
 * tears the webServer process down via `launchProcess`'s `gracefullyClose`;
 * its own `attemptToGracefullyClose` explicitly throws
 * "Graceful shutdown is not supported on Windows" whenever
 * `gracefulShutdown` isn't configured (which it isn't here), so on Windows
 * teardown is a forceful process-tree kill, not a signal our own
 * `SIGTERM`/`exit` handlers below are guaranteed to see in time to await
 * the Neon branch DELETE call. The handlers are still installed as
 * best-effort (they DO fire on a normal `next dev` exit, and may fire
 * before a forceful kill completes on some platforms) — the scheduled
 * cleanup job `docs/neon-branch-cleanup.md` describes is the authoritative
 * safety net for whatever this best-effort path misses, exactly the same
 * safety net already relied on for any other killed test run.
 */
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import {
  buildConnectionUri,
  neonApi,
  requiredEnv,
  type NeonCreateBranchResponse,
} from "../../tests/setup/neon-branch-lib";
import { E2E_DB_INFO_PATH } from "../../tests/e2e/e2e-db-info";

loadEnvConfig(process.cwd());

const APP_ROLE = "quimia_app";
const DATABASE_NAME = "neondb";

interface EphemeralBranch {
  appDatabaseUrl: string;
  deleteBranch: () => Promise<void>;
}

async function createEphemeralBranch(): Promise<EphemeralBranch> {
  const apiKey = requiredEnv("NEON_API_KEY");
  const projectId = requiredEnv("NEON_PROJECT_ID");
  const parentBranchId = requiredEnv("NEON_PARENT_BRANCH_ID");

  const runId = process.env.GITHUB_RUN_ID ?? "local";
  const branchName = `test-e2e-${runId}-${Date.now()}`;

  const created = await neonApi<NeonCreateBranchResponse>(
    apiKey,
    `/projects/${projectId}/branches`,
    {
      method: "POST",
      body: JSON.stringify({
        branch: { name: branchName, parent_id: parentBranchId },
        endpoints: [{ type: "read_write" }],
      }),
    },
  );

  const branchId = created.branch.id;
  const endpoint = created.endpoints[0];
  const database =
    created.databases.find((d) => d.name === DATABASE_NAME) ??
    created.databases[0];
  const ownerRoleName = database.owner_name;

  let deleted = false;
  const deleteBranch = async () => {
    if (deleted) return;
    deleted = true;
    await neonApi(apiKey, `/projects/${projectId}/branches/${branchId}`, {
      method: "DELETE",
    });
  };

  try {
    const { password: ownerPassword } = await neonApi<{ password: string }>(
      apiKey,
      `/projects/${projectId}/branches/${branchId}/roles/${ownerRoleName}/reveal_password`,
    );
    const ownerDatabaseUrl = buildConnectionUri(
      endpoint.host,
      ownerRoleName,
      ownerPassword,
      database.name,
    );

    // Same Windows `npx` ENOENT reason as `neon-global-setup.ts`.
    const npxOptions = { shell: true, stdio: "inherit" as const };

    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      ...npxOptions,
      env: { ...process.env, DIRECT_DATABASE_URL: ownerDatabaseUrl },
    });

    const appPassword = randomUUID();
    execFileSync("npx", ["tsx", "scripts/db/provision-app-role.ts"], {
      ...npxOptions,
      env: {
        ...process.env,
        DIRECT_DATABASE_URL: ownerDatabaseUrl,
        APP_DB_PASSWORD: appPassword,
      },
    });

    const appDatabaseUrl = buildConnectionUri(
      endpoint.hosts.read_write_pooled_host,
      APP_ROLE,
      appPassword,
      database.name,
    );

    await writeFile(
      E2E_DB_INFO_PATH,
      JSON.stringify({ appDatabaseUrl, ownerDatabaseUrl }),
      "utf8",
    );

    return { appDatabaseUrl, deleteBranch };
  } catch (err) {
    await deleteBranch();
    throw err;
  }
}

async function main(): Promise<void> {
  const { appDatabaseUrl, deleteBranch } = await createEphemeralBranch();
  const port = process.env.E2E_PORT ?? "3100";
  const runtimeEnv = { ...process.env, DATABASE_URL: appDatabaseUrl };

  // `next build` + `next start`, NOT `next dev` — Turbopack's dev-mode
  // lazy compile-on-first-request was empirically too slow for this
  // route's full dependency graph (Base UI Field/Input primitives,
  // Better Auth's cookie utils, the generated Prisma client): a bare
  // `page.goto` to `/sign-in` never resolved within a 60s test timeout on
  // the very first request. A production build compiles everything
  // upfront (its own timeout, `webServer.timeout`, budgets for that) so
  // every REQUEST afterward is served from already-compiled code — this
  // is a deliberate deviation from `next dev`, not an oversight (see
  // `docs/e2e-testing.md`).
  try {
    execFileSync("npx", ["next", "build"], {
      shell: true,
      stdio: "inherit",
      env: runtimeEnv,
    });
  } catch (err) {
    await deleteBranch();
    throw err;
  }

  const child = spawn("npx", ["next", "start", "-p", port], {
    stdio: "inherit",
    shell: true,
    env: runtimeEnv,
  });

  let cleaningUp = false;
  const cleanup = async (exitCode: number) => {
    if (cleaningUp) return;
    cleaningUp = true;
    await deleteBranch().catch((err: unknown) => {
      console.error("start-server: failed to delete ephemeral branch", err);
    });
    process.exit(exitCode);
  };

  child.on("exit", (code) => {
    void cleanup(code ?? 0);
  });
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  process.on("SIGINT", () => child.kill("SIGINT"));
}

main().catch((err: unknown) => {
  console.error("start-server: failed to start", err);
  process.exit(1);
});
