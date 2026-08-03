-- Hand-written migration. Must be applied by the schema OWNER/migration role
-- only (never by `quimia_app`) -- see prisma.config.ts (DIRECT_DATABASE_URL)
-- and ARCHITECTURE-SPINE.md AD-2/AD-10.
--
-- FORCE ROW LEVEL SECURITY subjects the table OWNER to RLS too, which is the
-- entire point (AD-2): without FORCE, a role that happens to own the table
-- silently bypasses every policy. `quimia_app` is deliberately NOT the owner.

-- 1. Runtime role: non-owner, created NOLOGIN here. LOGIN + password are set
--    out-of-band by scripts/db/provision-app-role.ts (idempotent, reads
--    APP_DB_PASSWORD from env) -- never committed to a migration file.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quimia_app') THEN
    CREATE ROLE quimia_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO quimia_app;

-- 2. Tenant-owned tables (AD-2). Repeat this block for every future
--    tenant-owned table (e.g. Patient, Order in later stories).
GRANT SELECT, INSERT, UPDATE, DELETE ON "user" TO quimia_app;
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user" FORCE ROW LEVEL SECURITY;

-- D5: policy reads current_setting('app.tenant_id', true) -- the wrapper
-- (src/shared/db, later PR) sets this via `SELECT set_config('app.tenant_id',
-- $1, true)` inside the same transaction as the query (SET LOCAL cannot be
-- parameterized; set_config(..., true) is the parameterized equivalent).
-- Fail-closed: current_setting(..., true) returns NULL when unset, and
-- "tenantId" = NULL evaluates to NULL (not TRUE) in Postgres, so an unscoped
-- query returns zero rows, never all rows.
CREATE POLICY tenant_isolation ON "user"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- 3. Tenant registry: RLS-exempt, column-narrow read only (D3). A view was
-- rejected -- FORCE RLS subjects the owner too, so an owner-rights view over
-- "tenant" would be filtered exactly like a direct query, buying nothing.
REVOKE ALL ON "tenant" FROM quimia_app;
GRANT SELECT ("id", "slug", "isActive") ON "tenant" TO quimia_app;

-- 4. Better Auth's own tables: NO RLS. Intentional (AD-2 threat-model
-- addendum, 2026-08-02) -- these are read by session token before any tenant
-- context exists, which is not scoped mode and not a named AD-3 bootstrap
-- flow. The token itself is the capability gate; do not "fix" this by adding
-- tenant_isolation policies here.
GRANT SELECT, INSERT, UPDATE, DELETE ON "session", "account", "verification" TO quimia_app;
