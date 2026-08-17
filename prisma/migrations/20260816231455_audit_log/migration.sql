-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_tenantId_idx" ON "audit_log"("tenantId");

-- CreateIndex (code-review follow-up 2026-08-16): every "history of this
-- record" query, including this story's own tests, filters by entityId.
CREATE INDEX "audit_log_entityId_idx" ON "audit_log"("entityId");

-- Hand-appended (Story 1.2 Task 1, AD-10, NFR-7). Must be applied by the
-- schema OWNER/migration role only (never `quimia_app`) -- same posture as
-- the rls_roles migration (AD-2, AD-10).
--
-- FORCE ROW LEVEL SECURITY subjects the table OWNER to RLS too (AD-2): the
-- owner does not implicitly bypass tenant isolation just by owning the table.
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;

-- D5, identical shape to "user"'s tenant_isolation policy: fail-closed --
-- current_setting(..., true) returns NULL when unset, and "tenantId" = NULL
-- evaluates to NULL (not TRUE), so an unscoped query returns zero rows.
CREATE POLICY tenant_isolation ON "audit_log"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- THE actual immutability mechanism (AD-10, NFR-7): quimia_app gets SELECT +
-- INSERT only. Deliberately NO UPDATE/DELETE grant -- enforced by Postgres
-- privileges, not application code that a bug or a future dev could bypass.
-- A denied UPDATE/DELETE here is a permission-denied error (42501), which
-- happens BEFORE row-level security is even evaluated -- it is not an RLS
-- (zero-rows) outcome.
GRANT SELECT, INSERT ON "audit_log" TO quimia_app;
