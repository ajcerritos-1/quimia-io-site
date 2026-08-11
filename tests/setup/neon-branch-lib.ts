/**
 * Shared Neon branch-lifecycle primitives (D9, AD-9). Extracted, UNCHANGED,
 * from `neon-global-setup.ts` (which used to define these privately) so
 * `scripts/e2e/start-server.ts` (Playwright's own ephemeral-branch-per-run
 * harness, Phase 7) can reuse the exact same mechanism the Vitest
 * integration harness already uses, instead of re-implementing it. Pure
 * relocation — no behavior change; `tests/integration/harness-smoke.test.ts`
 * still exercises this code end-to-end via `neon-global-setup.ts`'s own
 * `setup()`.
 */

export const NEON_API_BASE = "https://console.neon.tech/api/v2";

export interface NeonEndpoint {
  host: string;
  hosts: { read_write_pooled_host: string };
}

export interface NeonCreateBranchResponse {
  branch: { id: string };
  endpoints: NeonEndpoint[];
  databases: Array<{ name: string; owner_name: string }>;
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. See .env.example for the full ` +
        "list of vars the Neon branch harness needs.",
    );
  }
  return value;
}

export async function neonApi<T>(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${NEON_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Neon API ${init?.method ?? "GET"} ${path} failed ` +
        `(${res.status}): ${body}`,
    );
  }
  // 204 No Content (e.g. DELETE) has no body to parse.
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function buildConnectionUri(
  host: string,
  role: string,
  password: string,
  database: string,
): string {
  return (
    `postgresql://${encodeURIComponent(role)}:${encodeURIComponent(password)}` +
    `@${host}/${database}?sslmode=require`
  );
}
