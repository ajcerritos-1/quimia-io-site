/**
 * Vitest `globalSetup` — ephemeral Neon branch per test run (AD-9, D9).
 *
 * Runs in its OWN process, separate from test workers. `process.env`
 * mutations made here are NOT visible to workers — the only supported
 * channel to hand data to workers is `provide()`/`inject()`, consumed by
 * `tests/setup/env.ts` (a `setupFiles` entry, which DOES run in-worker).
 *
 * Lifecycle per test run:
 *   1. Create a branch off `NEON_PARENT_BRANCH_ID` (expected to already have
 *      every migration applied — branching copies schema + roles + data).
 *   2. Run `prisma migrate deploy` as the owner role (idempotent — a
 *      no-op if the parent already has every migration applied; forward
 *      compatible once new migrations land).
 *   3. Run `scripts/db/provision-app-role.ts` to set a fresh, run-scoped
 *      password on `quimia_app` (never trust a copied/inherited password).
 *   4. `provide()` both connection strings to workers.
 *   5. Return a teardown closure that deletes the branch — Vitest calls
 *      this on BOTH pass and fail (see `_teardownGlobalSetup` in Vitest's
 *      runner), so a failing test run still cleans up.
 *
 * This file is TDD-exempt scaffolding (design.md "Test Infrastructure" —
 * you cannot test-drive the harness that the first RED test depends on).
 * It is smoke-tested end-to-end by `tests/integration/harness-smoke.test.ts`
 * instead of unit-tested in isolation.
 *
 * The Neon branch-lifecycle primitives below (`neonApi`, `buildConnectionUri`,
 * `requiredEnv`) live in `./neon-branch-lib` — extracted, unchanged, so
 * `scripts/e2e/start-server.ts` (Phase 7's Playwright harness) can reuse the
 * exact same mechanism instead of re-implementing it.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import {
  buildConnectionUri,
  neonApi,
  requiredEnv,
  type NeonCreateBranchResponse,
} from "./neon-branch-lib";

// Same P1010-guard pattern as prisma.config.ts / provision-app-role.ts:
// explicitly load .env before reading any of the vars below. Vitest does
// not auto-load .env files the way Next.js's own dev/build process does.
loadEnvConfig(process.cwd());

const APP_ROLE = "quimia_app";
const DATABASE_NAME = "neondb";

declare module "vitest" {
  export interface ProvidedContext {
    appDatabaseUrl: string;
    ownerDatabaseUrl: string;
    neonBranchId: string;
  }
}

interface GlobalSetupContext {
  provide: <T>(key: string, value: T) => void;
}

export async function setup({ provide }: GlobalSetupContext) {
  const apiKey = requiredEnv("NEON_API_KEY");
  const projectId = requiredEnv("NEON_PROJECT_ID");
  const parentBranchId = requiredEnv("NEON_PARENT_BRANCH_ID");

  const runId = process.env.GITHUB_RUN_ID ?? "local";
  const branchName = `test-${runId}-${Date.now()}`;

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

    // `shell: true` is required for `npx` to resolve on Windows (it is a
    // `.cmd` shim there, not a directly-spawnable executable — plain
    // `execFileSync("npx", ...)` fails with ENOENT on Windows without it).
    // Harmless on POSIX, where it just runs through `/bin/sh -c`.
    const npxOptions = { shell: true, stdio: "inherit" as const };

    // Owner role runs migrations directly (unpooled) — D10, prisma.config.ts.
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      ...npxOptions,
      env: { ...process.env, DIRECT_DATABASE_URL: ownerDatabaseUrl },
    });

    // Always mint a fresh, run-scoped password rather than trusting whatever
    // password Neon's branch copy may have assigned to `quimia_app` — this
    // also exercises provision-app-role.ts as real integration evidence.
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

    provide("appDatabaseUrl", appDatabaseUrl);
    provide("ownerDatabaseUrl", ownerDatabaseUrl);
    provide("neonBranchId", branchId);
  } catch (err) {
    await deleteBranch();
    throw err;
  }

  return async () => {
    await deleteBranch();
  };
}
