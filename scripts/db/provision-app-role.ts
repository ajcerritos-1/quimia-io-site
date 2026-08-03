/**
 * Idempotent provisioning for the `quimia_app` runtime role.
 *
 * The rls_roles migration (owner role) creates `quimia_app` as NOLOGIN — a
 * role with no way to connect. This script is the ONLY place that grants it
 * LOGIN + a password, read from `APP_DB_PASSWORD`. It must be re-runnable
 * safely (CI, ephemeral Neon branches, local dev) without erroring on a role
 * that already has a password set (AD-2, D10; design.md "Test Infrastructure").
 *
 * Connects with `DIRECT_DATABASE_URL` (owner/migration role) — never with
 * `DATABASE_URL` (the pooled app-role connection), since only the owner role
 * can ALTER another role.
 *
 * Usage:
 *   DIRECT_DATABASE_URL=... APP_DB_PASSWORD=... npx tsx scripts/db/provision-app-role.ts
 */
import { loadEnvConfig } from "@next/env";
import { Client, escapeIdentifier, escapeLiteral } from "pg";

loadEnvConfig(process.cwd());

const APP_ROLE = "quimia_app";

async function main() {
  const directDatabaseUrl = process.env.DIRECT_DATABASE_URL;
  const appDbPassword = process.env.APP_DB_PASSWORD;

  if (!directDatabaseUrl) {
    throw new Error(
      "provision-app-role: DIRECT_DATABASE_URL is required (owner/migration role connection).",
    );
  }
  if (!appDbPassword) {
    throw new Error(
      "provision-app-role: APP_DB_PASSWORD is required (password to set on the quimia_app role).",
    );
  }

  const client = new Client({ connectionString: directDatabaseUrl });
  await client.connect();

  try {
    // Role is created NOLOGIN by the rls_roles migration. Guard here too so
    // this script is safe to run standalone before that migration, or against
    // a role that already exists (idempotent — safe to re-run every branch).
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${escapeLiteral(APP_ROLE)}) THEN
          CREATE ROLE ${escapeIdentifier(APP_ROLE)} NOLOGIN;
        END IF;
      END $$;
    `);

    // escapeLiteral safely quotes the password (handles embedded quotes) so
    // this remains injection-safe without relying on parameter binding for a
    // utility statement (ALTER ROLE is not parameterizable via the extended
    // query protocol the way DML statements are).
    await client.query(
      `ALTER ROLE ${escapeIdentifier(APP_ROLE)} WITH LOGIN PASSWORD ${escapeLiteral(appDbPassword)};`,
    );

    console.log(`provision-app-role: '${APP_ROLE}' now has LOGIN and an updated password.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("provision-app-role: failed:", err);
  process.exitCode = 1;
});
