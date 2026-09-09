-- Hand-written migration (Story 2.1, AD-2/AD-3/AD-6/AD-8). Must be applied by
-- the schema OWNER/migration role only (never `quimia_app`) -- see
-- prisma.config.ts (DIRECT_DATABASE_URL) and ARCHITECTURE-SPINE.md AD-2/AD-10.
--
-- Generated body: 5x CreateTable + CreateIndex produced by `prisma migrate
-- diff` over the migration history -> schema delta (identical output to
-- `migrate dev --create-only`; the dev branch had pre-existing drift, so the
-- same diff engine was run against the clean history instead). The RLS block
-- below is hand-appended per table, identical in shape to the rls_roles
-- migration's tenant-owned block (AD-2) and the audit_log migration.
--
-- FORCE ROW LEVEL SECURITY subjects the table OWNER to RLS too (AD-2): the
-- owner does not implicitly bypass tenant isolation just by owning the table.
-- `quimia_app` is deliberately NOT the owner.

-- CreateTable
CREATE TABLE "method" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technique" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "calibrationDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "container" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_type" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sample_type_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "method_tenantId_idx" ON "method"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "method_tenantId_name_key" ON "method"("tenantId", "name");

-- CreateIndex
CREATE INDEX "technique_tenantId_idx" ON "technique"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "technique_tenantId_name_key" ON "technique"("tenantId", "name");

-- CreateIndex
CREATE INDEX "equipment_tenantId_idx" ON "equipment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_tenantId_name_key" ON "equipment"("tenantId", "name");

-- CreateIndex
CREATE INDEX "container_tenantId_idx" ON "container"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "container_tenantId_name_key" ON "container"("tenantId", "name");

-- CreateIndex
CREATE INDEX "sample_type_tenantId_idx" ON "sample_type"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sample_type_tenantId_name_key" ON "sample_type"("tenantId", "name");

-- Hand-appended (Story 2.1, AD-2). Applied by the schema OWNER/migration role
-- only (never quimia_app) -- FORCE RLS subjects the owner to RLS too.
GRANT SELECT, INSERT, UPDATE, DELETE ON "method" TO quimia_app;
ALTER TABLE "method" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "method" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "method"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Hand-appended (Story 2.1, AD-2). Applied by the schema OWNER/migration role
-- only (never quimia_app) -- FORCE RLS subjects the owner to RLS too.
GRANT SELECT, INSERT, UPDATE, DELETE ON "technique" TO quimia_app;
ALTER TABLE "technique" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "technique" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "technique"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Hand-appended (Story 2.1, AD-2). Applied by the schema OWNER/migration role
-- only (never quimia_app) -- FORCE RLS subjects the owner to RLS too.
GRANT SELECT, INSERT, UPDATE, DELETE ON "equipment" TO quimia_app;
ALTER TABLE "equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipment" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "equipment"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Hand-appended (Story 2.1, AD-2). Applied by the schema OWNER/migration role
-- only (never quimia_app) -- FORCE RLS subjects the owner to RLS too.
GRANT SELECT, INSERT, UPDATE, DELETE ON "container" TO quimia_app;
ALTER TABLE "container" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "container" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "container"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Hand-appended (Story 2.1, AD-2). Applied by the schema OWNER/migration role
-- only (never quimia_app) -- FORCE RLS subjects the owner to RLS too.
GRANT SELECT, INSERT, UPDATE, DELETE ON "sample_type" TO quimia_app;
ALTER TABLE "sample_type" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sample_type" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "sample_type"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));