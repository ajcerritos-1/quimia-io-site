-- Story 2.2 (slice 1/2) — study catalog schema migration (AD-2, AD-3, AD-21,
-- ADR-3 composite tenant-scoped foreign keys, ADR-6 onDelete Restrict).
-- Must be applied by the schema OWNER/migration role only (never quimia_app).
--
-- Body: prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- run against an ephemeral branch that already has the five committed migrations
-- applied (no shadow database; see openspec/changes/study-schema/tasks.md 2.4).
--
-- Composite (fk, "tenantId") -> (id, "tenantId") keys are required: PostgreSQL
-- referential-integrity checks bypass RLS, so a single-column FK would let a
-- tenant-A study reference a tenant-B catalog row.
-- AlterTable
ALTER TABLE "container" ADD COLUMN     "color" TEXT;

-- CreateTable
CREATE TABLE "study" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "sampleTypeId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "techniqueId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "patientConditions" TEXT,
    "processDays" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,2) NOT NULL,
    "tax" BOOLEAN NOT NULL DEFAULT false,
    "printMethod" BOOLEAN NOT NULL DEFAULT false,
    "printTechnique" BOOLEAN NOT NULL DEFAULT false,
    "printEquipment" BOOLEAN NOT NULL DEFAULT false,
    "printSample" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_container" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,

    CONSTRAINT "study_container_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "study_tenantId_idx" ON "study"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "study_tenantId_code_key" ON "study"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "study_id_tenantId_key" ON "study"("id", "tenantId");

-- CreateIndex
CREATE INDEX "study_container_tenantId_idx" ON "study_container"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "study_container_studyId_containerId_key" ON "study_container"("studyId", "containerId");

-- CreateIndex
CREATE UNIQUE INDEX "container_id_tenantId_key" ON "container"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_id_tenantId_key" ON "equipment"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "method_id_tenantId_key" ON "method"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sample_type_id_tenantId_key" ON "sample_type"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "technique_id_tenantId_key" ON "technique"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "study" ADD CONSTRAINT "study_sample_type_fkey" FOREIGN KEY ("sampleTypeId", "tenantId") REFERENCES "sample_type"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study" ADD CONSTRAINT "study_method_fkey" FOREIGN KEY ("methodId", "tenantId") REFERENCES "method"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study" ADD CONSTRAINT "study_technique_fkey" FOREIGN KEY ("techniqueId", "tenantId") REFERENCES "technique"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study" ADD CONSTRAINT "study_equipment_fkey" FOREIGN KEY ("equipmentId", "tenantId") REFERENCES "equipment"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_container" ADD CONSTRAINT "study_container_study_fkey" FOREIGN KEY ("studyId", "tenantId") REFERENCES "study"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_container" ADD CONSTRAINT "study_container_container_fkey" FOREIGN KEY ("containerId", "tenantId") REFERENCES "container"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-appended (Story 2.2, AD-2/AD-3). `container.color` needs no grant or policy:
-- the 2.1 table-level GRANT on "container" covers new columns.
-- Applied by the schema OWNER/migration role only (never quimia_app); FORCE RLS
-- subjects the owner to RLS too.
GRANT SELECT, INSERT, UPDATE, DELETE ON "study" TO quimia_app;
ALTER TABLE "study" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "study"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Hand-appended (Story 2.2, AD-2/AD-3). Same shape as the 2.1 block.
GRANT SELECT, INSERT, UPDATE, DELETE ON "study_container" TO quimia_app;
ALTER TABLE "study_container" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_container" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "study_container"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
