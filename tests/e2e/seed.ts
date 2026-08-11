/**
 * Seeding helper for Playwright e2e specs (Phase 7). Mirrors the exact
 * seeding pattern `tests/integration/auth-sign-in.test.ts` (PR 4a) uses —
 * direct `pg.Client` inserts against the owner role connection, since the
 * app role's RLS grants forbid inserting a `tenant` row (D3's column-narrow
 * grant is SELECT-only) and there is no tenant-scoped context yet to write
 * a `user` row under before one exists.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";
import { E2E_DB_INFO_PATH, type E2eDbInfo } from "./e2e-db-info";

export function readE2eDbInfo(): E2eDbInfo {
  return JSON.parse(readFileSync(E2E_DB_INFO_PATH, "utf8")) as E2eDbInfo;
}

export async function withOwnerClient<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const { ownerDatabaseUrl } = readE2eDbInfo();
  const client = new Client({ connectionString: ownerDatabaseUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export interface SeededTenant {
  tenantId: string;
  slug: string;
}

export interface SeededUser {
  userId: string;
  email: string;
  nickname: string;
}

export async function seedTenant(client: Client): Promise<SeededTenant> {
  const tenantId = `tenant-e2e-${randomUUID()}`;
  const slug = `lab-e2e-${randomUUID().slice(0, 8)}`;
  await client.query(
    `INSERT INTO "tenant" (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [tenantId, slug, "E2E Lab"],
  );
  return { tenantId, slug };
}

export async function seedUser(
  client: Client,
  tenantId: string,
  password: string,
): Promise<SeededUser> {
  const userId = `user-e2e-${randomUUID()}`;
  const email = `e2e-${randomUUID()}@example.com`;
  const nickname = `e2euser${randomUUID().slice(0, 8)}`;
  await client.query(
    `INSERT INTO "user" (id, "tenantId", email, nickname, name, role, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'admin', now())`,
    [userId, tenantId, email, nickname, "E2E User"],
  );
  const hash = await hashPassword(password);
  await client.query(
    `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, now())`,
    [`account-e2e-${randomUUID()}`, userId, userId, hash],
  );
  return { userId, email, nickname };
}
