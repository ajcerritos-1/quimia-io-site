# Design: Study Catalog Schema (Story 2.2, Slice 1/2)

> Technical design for the `Study` + `StudyContainer` schema substrate, the
> `Container.color` column, and the AD-21 spine ratification. Schema + one
> migration + docs + integration tests only — no UI, actions, route, registry,
> audit write path, or seed data (slice 2/2 `configuracion-study-crud`).
>
> Every structural decision below is traced to its bound AD from
> `ARCHITECTURE-SPINE.md` (AD-1..AD-12, plus the newly ratified AD-21).

## Technical Approach

Add two tenant-owned tables (`study`, `study_container`), one nullable column
(`container.color`), two composite-unique keys and six composite foreign keys,
then hand-append the RLS/GRANT block to the generated migration. All DDL flows
through **one** owner-role migration; all runtime access keeps flowing through
`src/shared/db` (AD-3); the wrapper itself is untouched because it is
model-agnostic (`$allModels.$allOperations`).

The one non-obvious structural call — and the reason this design deviates from
the proposal's plain-FK field table — is **composite tenant-scoped foreign
keys**. The proposal and the `study-catalog` spec both assert that
"cross-tenant FK resolution is structurally impossible" because the referenced
catalog row is RLS-hidden. That reasoning is **factually wrong**: PostgreSQL's
own documentation states that *"Referential integrity checks, such as unique or
primary key constraints and foreign key references, always bypass row security
to ensure that data integrity is maintained."* Under RLS-alone, a `study` row
scoped to tenant A can satisfy a plain FK to tenant B's `method` row — the RI
check runs as the table owner and ignores the policy. The only mechanism that
delivers the requirement is a composite FK on `(fk, tenantId)` referencing
`(id, tenantId)`. This is Decision 2 below and it is load-bearing.

## Architecture Decisions

Each decision names the bound AD and the rejected alternatives with the reason.

### ADR-1 — `Study` model shape + bare `tenantId` + per-tenant `code` uniqueness

- **Bound ADs:** AD-4 (Study is the ratified hinge entity), AD-8 (per-tenant
  uniqueness override), AD-2/AD-3 (tenant-owned table: bare `tenantId`, RLS).
- **Choice:** model `Study` exactly as the field contract
  (`study-catalog/spec.md` requirement 1 / proposal lines 92–111):
  `id cuid(2)`, bare `tenantId String` (no FK to `Tenant` — `AuditLog`
  precedent), `code`, `name`, `area`, the three required catalog FKs, nullable
  `equipmentId`, nullable `patientConditions`, `processDays Int @default(1)`,
  `price Decimal @db.Decimal(10,2)`, `tax Boolean @default(false)`, four print
  booleans `@default(false)`, `isActive Boolean @default(true)`, timestamps,
  `@@map("study")`, `@@index([tenantId])`, `@@unique([tenantId, code])`.
- **Alternatives rejected:**
  - `@@unique([tenantId, name])` — rejected: D7 ratified `code`-only uniqueness;
    the spec scenario "Same name within a tenant is allowed" forbids it.
  - Optional `price` — the spec field contract marks `price` **required**;
    `null` prices are left to a later slice if the D9 wording ever needs it.
  - FK `tenantId → Tenant` — rejected: `AuditLog`/0.2.1 precedent keeps
    `tenantId` bare; a `Tenant` FK would also chain a non-RLS-exempt table into
    the referential graph.
- **Rationale:** mirrors the shipped 2.1 catalog contract exactly, so the same
  reviewers apply the same mental model.

### ADR-2 — Explicit `StudyContainer` join model (not Prisma implicit M2M)

- **Bound ADs:** AD-21 (many-to-many), AD-2 (RLS needs a per-table `tenantId`).
- **Choice:** explicit `StudyContainer` model mapped to `study_container`, with
  its own `tenantId` and hand-appended RLS.
- **Alternatives rejected:** Prisma implicit `_StudyToContainer` — an implicit
  join table has **no `tenantId` column**, so no `tenant_isolation` policy can
  be attached; it could not be RLS-protected at all.
- **Rationale:** AD-21 requires a study to require more than one tube (e.g. a
  chemistry panel drawing serum + fluoride/oxalate); the explicit model is the
  only shape that is both M:N and RLS-protectable.

### ADR-3 — Cross-tenant prevention: composite FK, not RLS reliance — **[LOAD-BEARING]**

- **Bound ADs:** AD-2 (Neon + RLS + `FORCE RLS`), AD-3 (single scoped wrapper),
  NFR-1 (tenant isolation). Also AD-6 (catalog lookup, not order identity).
- **Choice:** every tenant-scoped FK introduced by this change is **composite**:
  the referencing row carries `tenantId`, and the FK references
  `(id, tenantId)` on the target. Concretely:
  - `study (sampleTypeId, tenantId) → sample_type (id, tenantId)`
  - `study (methodId, tenantId) → method (id, tenantId)`
  - `study (techniqueId, tenantId) → technique (id, tenantId)`
  - `study (equipmentId, tenantId) → equipment (id, tenantId)`
  - `study_container (studyId, tenantId) → study (id, tenantId)`
  - `study_container (containerId, tenantId) → container (id, tenantId)`
  This requires `@@unique([id, tenantId])` on `study`, `container`, `method`,
  `technique`, `equipment`, and `sample_type`.
- **Alternatives rejected:**
  - **RLS reliance alone** — provably insufficient. RI checks bypass RLS
    (PostgreSQL docs, "Row Security Policies"). A join row with
    `tenantId = A` passes the `WITH CHECK` policy and still resolves a plain FK
    to tenant B's `container`; the identical hole exists for the scalar catalog
    FKs on `study`. This is the exact hole the spec's "structurally impossible"
    language intends to close.
  - **App-boundary-only** ("A can never learn B's id because RLS hides it") —
    rejected as the *sole* mechanism: it is a defense-in-depth property, not a
    structural guarantee, and it does not satisfy the spec's own scenario, which
    a RED test will exercise directly (seed via owner, then attempt the write as
    `quimia_app`). It is retained only as a second layer.
  - **Per-row validation trigger** — rejected: triggers are invisible to the
    Prisma datamodel, cannot be expressed in `schema.prisma`, and would make
    `migrate diff` / introspection report a schema the client cannot see. A
    declarative composite FK is visible, typed, and drift-free.
- **Rationale:** with one shared `tenantId` column participating in both the
  `study` and `container` FKs on a `study_container` row, the row can only
  reference a study and a container that share the **same** tenant as the row
  itself. Linking tenant A's study to tenant B's container would require the
  join row's `tenantId` to equal A (to satisfy the study FK) *and* B (to satisfy
  the container FK) at once — impossible on a single column. The scalar catalog
  FKs get the same guarantee for the same reason.
- **Cost / scope note:** this adds `@@unique([id, tenantId])` to the five
  already-shipped 2.1 catalog tables (index-only — **no new column**, so the
  "closed field contract" in `supporting-catalogs` is not violated) and makes
  the six relations composite. See "Spec ↔ Design Disagreements".

### ADR-4 — `Container.color` format: nullable human-readable color name

- **Bound AD:** AD-21 (Container carries a color).
- **Choice:** `color String?` storing a **human-readable color name**
  (e.g. `"lila"`, `"amarillo"`, `"rojo"`). Nullable. No enum, no hex in the DB.
- **Alternatives rejected:**
  - **Hex value** — rejected: pushes presentation knowledge onto the lab admin
    (who authors "tubo lila EDTA", not `#B39DDB`), and the spec's own scenario
    stores the name `"lila"`, not a hex literal. A hex column would also make
    the column's meaning a rendering concern owned by the wrong layer.
  - **Postgres enum** — rejected: real tube-colour vocabularies are large and
    regionally idiosyncratic (BD Vacutainer ships 20+ colours); every new colour
    would need a migration. An enum also cannot express vendor-specific names.
  - **App-validated Zod enum over a `String` column** — *not* rejected outright,
    but deferred: this slice ships no Zod and no UI, so DB validation here would
    have no author. The name column stays open; slice 2/2 may constrain the
    admin input.
- **What the UI renders later:**
  - **Slice 2/2 (`configuracion-study-crud`):** the Container admin form renders
    `color` as a free-text input (optionally a combobox seeded with the common
    BD Vacutainer names); `NULL` means "no tube colour" (Frasco, Laminilla).
  - **Epic 6 (Story 6.4 label printing):** the label renderer maps the stored
    name to a fill colour through a **presentation-only** swatch map
    (e.g. `CONTAINER_COLOR_SWATCH: Record<string, string>`), falling back to a
    neutral fill for unknown or `NULL` names. The name → swatch mapping is owned
    by the printing/presentation layer, not by `catalog`.
- **Rationale:** dedup for label cardinality is by **distinct container entity**
  (`containerId`), not by colour value (AD-21 rule 3); colour is a display
  attribute, so it belongs in the store as authored data, with rendering left to
  the presentation layer.

### ADR-5 — Migration workflow: `prisma migrate diff` + hand-append

- **Bound ADs:** AD-2 (owner/migration role applies DDL), AD-9 (test-time DB
  topology), plus the `.gitattributes` LF pin (commit `c94c0a9`).
- **Choice:** generate the DDL body with
  `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script`,
  then **hand-append** the RLS/GRANT block per new table. Apply with
  `prisma migrate deploy` as the owner role (`DIRECT_DATABASE_URL`).
- **Honest evaluation of the alternative (`migrate dev --create-only`):** Now
  that migration checksums are reconciled on both Neon branches and LF is pinned,
  the pre-existing drift that forced 2.1 onto `migrate diff` is **resolved**, so
  `prisma migrate dev --create-only` is *technically usable* again. It is still
  **not** the recommended path here, for two operational reasons on this
  project's infrastructure:
  1. `migrate dev` requires a **shadow database**. On Neon that means provisioning
     an extra branch/database — and Neon's free tier caps branches at 10, a live,
     recurring constraint (`deferred-work.md` lines 11–12). `migrate diff` over
     the committed history needs **no shadow database** and creates **no branch**.
  2. `migrate dev` is authoritative over the database it points at and can prompt
     to reset on any divergence — undesirable against a **shared** dev branch.
     `migrate diff` is a pure, deterministic function of the committed history and
     the datamodel.
  So the drift workaround is no longer the *reason*; the shadow-DB/branch-cap and
  shared-branch determinism are. Either path produces the same DDL engine output;
  both require the same manual RLS append.
- **Rationale:** deterministic, branch-free, reproducible, and identical in final
  form to the 2.1 precedent (`20260907234515_catalog_supporting_models`).
- **LF is mandatory.** `.gitattributes` pins `prisma/migrations/** text eol=lf`.
  If the working-tree `migration.sql` is written with CRLF, `migrate deploy`
  records a sha256 that will not match a fresh LF checkout → it **reintroduces
  the exact checksum-drift class** `c94c0a9` fixed. Apply-phase step: after
  writing the file, verify it is LF (e.g. `git diff --check` shows no
  `CRLF will be replaced by LF` warning, or the file has no `\r` bytes) **before**
  `migrate deploy`.

### ADR-6 — `onDelete: Restrict` on every catalog relation

- **Bound ADs:** AD-6 (Container/catalogs are lookups), 2.1 lifecycle contract
  (deactivate-not-delete).
- **Choice:** `onDelete: Restrict` on all six composite FKs. `onUpdate` left at
  Prisma's default (`Cascade`).
- **Rationale:** the DB, not app discipline, enforces that a referenced catalog
  row cannot be hard-deleted or orphaned while a study references it; deactivation
  (`isActive = false`) keeps it referenceable. Matches the spec scenarios "Deleting
  a referenced catalog row fails" / "A deactivated catalog row remains
  referenceable".

### ADR-7 — Ratify AD-21 in this change (spine + ERD note)

- **Bound AD:** AD-21 (the new decision this change ratifies).
- **Choice:** append AD-21 to `ARCHITECTURE-SPINE.md` immediately after AD-12 and
  correct the contradicting ERD note. Exact text in "AD-21 Ratification" below.
- **Alternatives rejected:** deferring the spine edit to slice 2/2 — rejected:
  F7's whole finding (`review-adversarial-incompatibility.md` lines 241–266) is
  that the tube/color decision sits in limbo as "a binding-looking sentence with
  no ratification status". Building the schema on AD-21 while leaving the spine
  at AD-1..AD-12 reproduces exactly that limbo.
- **Rationale:** the spine must remain the single source of truth; a decision the
  schema now depends on cannot live only in a review file.

### ADR-8 — This slice writes no runtime code and no audit path

- **Bound ADs:** AD-1 (module boundary), AD-3 (DB access wrapper), AD-10
  (audit write path — slice 2/2).
- **Choice:** no `src/` files change; no `prisma.<model>` call is introduced; the
  `src/shared/db` wrapper is untouched; no `STUDY_*` audit constants and no
  AuditLog write. Test files may import `scoped()` (as the 2.1 cuid2 test does)
  to prove cuid2 generation through the real wrapper; raw `pg` clients are used
  only for structural/RLS assertions, which is harness code, not application DB
  access.
- **Rationale:** keeps the change at the schema substrate; AD-10 binds slice 2/2.

### ADR-9 — Money stored as `Decimal(10,2)`; tax semantics left open

- **Bound AD:** NFR-9 (MXN currency, monetary precision).
- **Choice:** `price Decimal @db.Decimal(10,2)` required; `tax Boolean
  @default(false)`.
- **Open:** tax-**inclusive vs exclusive** is **not** decided here (deferred to
  Epic 6 / the client's accountant, domain review R4). This design fixes the
  column's type and default only.

## Data Flow

Runtime read/write path (unchanged wrapper; new tables ride the existing RLS
mechanism):

```
caller ──► scoped({ tenantId, role })              [src/shared/db, AD-3]
              │  builds extended client ($allModels.$allOperations)
              ▼
           $transaction([
             set_config('app.tenant_id', <tenantId>, TRUE),
             set_config('app.role', <role>, TRUE),
             query(args),
           ])
              │
              ▼
           Postgres  ── RLS USING / WITH CHECK:  "tenantId" = current_setting('app.tenant_id', true)
                     ── composite FK:  (fk, "tenantId") must exist in target (id, "tenantId")
```

Migration/apply path:

```
owner role (DIRECT_DATABASE_URL)  ──►  prisma migrate deploy
                                          ├─ CREATE TABLE study, study_container
                                          ├─ ALTER TABLE container ADD COLUMN color
                                          ├─ CREATE UNIQUE INDEX ...(id, tenantId) ×6
                                          ├─ ADD CONSTRAINT ... FOREIGN KEY (fk, tenantId) ×6
                                          └─ GRANT / ENABLE+FORCE RLS / CREATE POLICY ×2
```

## Sequence Diagrams

### S1 — Migration / apply flow (owner role → DDL → RLS/policy/grant → verify)

```
Owner shell           Prisma CLI                      Neon (ephemeral/dev branch)
   │                     │                                     │
   │  migrate diff ────► │  diff(committed migrations, schema)  │
   │  (--from-migrations │  NO shadow DB, NO new branch ───────►│ (read-only introspection)
   │   --to-schema-      │                                     │
   │   datamodel)        │◄──── DDL body (tables/index/FK) ─────│
   │◄── DDL body ────────│                                     │
   │                     │                                     │
   │  HAND-APPEND RLS block (study, study_container):           │
   │    GRANT SELECT, INSERT, UPDATE, DELETE ON <t> TO quimia_app;
   │    ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
   │    ALTER TABLE <t> FORCE ROW LEVEL SECURITY;
   │    CREATE POLICY tenant_isolation ON <t>
   │      USING (...) WITH CHECK (... on current_setting('app.tenant_id', true));
   │                     │                                     │
   │  VERIFY file is LF (no \r) BEFORE deploy                   │
   │                     │                                     │
   │  migrate deploy ──► │  sha256(LF bytes) ─────────────────►│ _prisma_migrations
   │                     │  apply DDL + RLS ──────────────────►│ study, study_container, container.color
   │                     │◄──────────── applied ───────────────│
   │                     │                                     │
   │  VERIFY ───────────►│  pg_class.relforcerowsecurity = true│
   │                     │  pg_policies.tenant_isolation present│
   │                     │  quimia_app grants present           │
   │◄── green ───────────│                                     │
```

### S2 — Scoped read/write + fail-closed unscoped path (RLS + composite FK)

```
scoped(ctx) ──► BEGIN; set_config('app.tenant_id', A); set_config('app.role', role)

  WRITE study | study_container  (row.tenantId = A)
     ├─ RLS WITH CHECK : row."tenantId" = A = app.tenant_id ? ──► yes: continue
     │                                                            no : INSERT/UPDATE rejected (row violates RLS)
     └─ composite FK   : target (id, `fk`) with tenantId = A exists ? ──► yes: commit
                                                                          no : FK violation 23503 ──► REJECTED

  READ study | study_container
     └─ RLS USING : only rows where "tenantId" = app.tenant_id are returned
        (tenant B rows are invisible — cross-tenant read returns zero)

  UNSCOPED (no app.tenant_id set)
     └─ current_setting('app.tenant_id', true) = NULL
        "tenantId" = NULL  ──►  NULL  ──►  zero rows  (fail-closed; NEVER all rows)
```

### S3 — Why RLS-alone fails and composite FK succeeds (ADR-3 evidence model)

```
Tenant A attempts: link A's study to B's container
  studyContainer.create({ data: { tenantId: "A", studyId: <A-study>, containerId: <B-container> } })

  RLS WITH CHECK       : "tenantId" ("A") = app.tenant_id ("A") ──► PASS  (row *looks* correctly scoped)
        │
        ├─ plain FK (rejected design): container(id=<B-container>) exists → RI check BYPASSES RLS → INSERT SUCCEEDS  ✗ LEAK
        │
        └─ composite FK (chosen): container(id=<B-container>, tenantId="A") → NOT FOUND → 23503 → INSERT REJECTED ✓
                                                                                    (tenantId can be A or B, never both)
```

## Prisma Model Definitions

Complete target shape (only the changed/new models shown; unchanged fields kept
verbatim). `@@unique([id, tenantId])` is added to each catalog target so the
composite FK has a unique criteria to reference.

### New: `Study`

```prisma
model Study {
  id                String   @id @default(cuid(2))
  tenantId          String
  code              String
  name              String
  area              String
  sampleTypeId      String
  methodId          String
  techniqueId       String
  equipmentId       String?
  patientConditions String?
  processDays       Int      @default(1)
  price             Decimal  @db.Decimal(10, 2)
  tax               Boolean  @default(false)
  printMethod       Boolean  @default(false)
  printTechnique    Boolean  @default(false)
  printEquipment    Boolean  @default(false)
  printSample       Boolean  @default(false)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Composite tenant-scoped FKs (ADR-3). onDelete Restrict = deactivate-not-delete (ADR-6).
  // `map` disambiguates because tenantId participates in four relations on this model.
  sampleType SampleType @relation(fields: [sampleTypeId, tenantId], references: [id, tenantId], onDelete: Restrict, map: "study_sample_type_fkey")
  method     Method     @relation(fields: [methodId, tenantId],     references: [id, tenantId], onDelete: Restrict, map: "study_method_fkey")
  technique  Technique  @relation(fields: [techniqueId, tenantId],  references: [id, tenantId], onDelete: Restrict, map: "study_technique_fkey")
  equipment  Equipment? @relation(fields: [equipmentId, tenantId],  references: [id, tenantId], onDelete: Restrict, map: "study_equipment_fkey")

  containers StudyContainer[]

  @@unique([tenantId, code]) // AD-8 per-tenant uniqueness (D7); name is NOT unique
  @@unique([id, tenantId])   // composite criteria for StudyContainer's FK (ADR-3)
  @@index([tenantId])
  @@map("study")
}
```

Notes:
- `equipment Equipment?` is optional because `equipmentId` is nullable; with a
  `MATCH SIMPLE` composite FK, a `NULL` `equipmentId` satisfies the constraint
  (never checked), so "study on no instrument" (D8) stays valid.
- `tenantId` is bare (no `Tenant` relation) — `AuditLog` precedent, AD-2/AD-3.

### New: `StudyContainer`

```prisma
model StudyContainer {
  id          String @id @default(cuid(2))
  tenantId    String
  studyId     String
  containerId String

  // Composite tenant-scoped FKs (ADR-3): the join row and both targets must share one tenantId.
  study     Study     @relation(fields: [studyId, tenantId],     references: [id, tenantId], onDelete: Restrict, map: "study_container_study_fkey")
  container Container @relation(fields: [containerId, tenantId], references: [id, tenantId], onDelete: Restrict, map: "study_container_container_fkey")

  @@unique([studyId, containerId]) // one link per distinct container per study
  @@index([tenantId])
  @@map("study_container")
}
```

- Fields are exactly the spec enumeration (`id`, `tenantId`, `studyId`,
  `containerId`) — **no `createdAt`/`updatedAt`**, deliberately deviating from the
  generic timestamp convention because the spec fixes the field set and the
  2.1-style schema test asserts an exact column list. A link row is created and
  (on re-link) deleted, not updated.

### Modified: `Container` (adds `color`, back-relation, composite key)

```prisma
model Container {
  id        String   @id @default(cuid(2))
  tenantId  String
  name      String
  color     String?  // AD-21 (D1): human-readable tube color name, e.g. "lila"; NULL for non-tube containers
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  studyContainers StudyContainer[] // AD-21: M2M via the explicit join model

  @@unique([tenantId, name])
  @@unique([id, tenantId]) // ADR-3 composite-FK criteria
  @@index([tenantId])
  @@map("container")
}
```

### Modified: `Method`, `Technique`, `Equipment`, `SampleType` (back-relation + composite key)

Each gains a relation-only back-reference and the composite-FK criteria; **no
persisted column changes**:

```prisma
// Method / Technique / SampleType:
  studies Study[]            // relation-only back-reference (no column)
  @@unique([id, tenantId])   // ADR-3 composite-FK criteria (index only, no column)

// Equipment (in addition to its existing model/serialNumber/calibrationDate):
  studies Study[]
  @@unique([id, tenantId])
```

> The existing `@@unique([tenantId, name])`, `@@index([tenantId])`, and `@@map`
> on all five are unchanged.

## Migration Plan

One hand-appended migration, filename `<timestamp>_study/migration.sql`
(timestamp generated at apply; 2.1 precedent used a fixed ISO-ish prefix).

### 1. DDL body source

```bash
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

Expected body shape (order is Prisma's; exact bytes are the generator's):

```sql
-- AlterTable (Container.color — additive, nullable; NO new GRANT, NO new RLS policy:
-- the existing `GRANT ... ON "container"` is table-level and covers new columns)
ALTER TABLE "container" ADD COLUMN "color" TEXT;

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

-- CreateIndex (composite criteria on the six FK targets + study/study_container)
CREATE UNIQUE INDEX "study_id_tenantId_key"        ON "study"("id", "tenantId");
CREATE UNIQUE INDEX "method_id_tenantId_key"       ON "method"("id", "tenantId");
CREATE UNIQUE INDEX "technique_id_tenantId_key"    ON "technique"("id", "tenantId");
CREATE UNIQUE INDEX "equipment_id_tenantId_key"    ON "equipment"("id", "tenantId");
CREATE UNIQUE INDEX "container_id_tenantId_key"    ON "container"("id", "tenantId");
CREATE UNIQUE INDEX "sample_type_id_tenantId_key"  ON "sample_type"("id", "tenantId");
CREATE INDEX        "study_tenantId_idx"           ON "study"("tenantId");
CREATE UNIQUE INDEX "study_tenantId_code_key"      ON "study"("tenantId", "code");
CREATE INDEX        "study_container_tenantId_idx" ON "study_container"("tenantId");
CREATE UNIQUE INDEX "study_container_studyId_containerId_key" ON "study_container"("studyId", "containerId");

-- AddForeignKey (composite; tenantId must match on both sides — ADR-3)
ALTER TABLE "study" ADD CONSTRAINT "study_sample_type_fkey"
  FOREIGN KEY ("sampleTypeId", "tenantId") REFERENCES "sample_type"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "study" ADD CONSTRAINT "study_method_fkey"
  FOREIGN KEY ("methodId", "tenantId") REFERENCES "method"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "study" ADD CONSTRAINT "study_technique_fkey"
  FOREIGN KEY ("techniqueId", "tenantId") REFERENCES "technique"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "study" ADD CONSTRAINT "study_equipment_fkey"
  FOREIGN KEY ("equipmentId", "tenantId") REFERENCES "equipment"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "study_container" ADD CONSTRAINT "study_container_study_fkey"
  FOREIGN KEY ("studyId", "tenantId") REFERENCES "study"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "study_container" ADD CONSTRAINT "study_container_container_fkey"
  FOREIGN KEY ("containerId", "tenantId") REFERENCES "container"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
```

### 2. Hand-appended RLS/GRANT block (per NEW table — verbatim 2.1 shape)

Only NEW tables get a grant/policy. `container` already has both; the added
column needs neither.

```sql
-- Hand-appended (Story 2.2, AD-2/AD-3). Applied by the schema OWNER/migration role
-- only (never quimia_app) — FORCE RLS subjects the owner to RLS too.
GRANT SELECT, INSERT, UPDATE, DELETE ON "study" TO quimia_app;
ALTER TABLE "study" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "study"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "study_container" TO quimia_app;
ALTER TABLE "study_container" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_container" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "study_container"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
```

### 3. Apply + LF check

1. Confirm the file is **LF** (no `\r` bytes) — `.gitattributes` enforces this on
   checkout; the working tree must match before `migrate deploy` or the recorded
   sha256 reintroduces drift (ADR-5).
2. `prisma migrate deploy` as the owner role via `DIRECT_DATABASE_URL` (never
   `quimia_app`).
3. Verify: `pg_class.relforcerowsecurity = true` on both new tables;
   `pg_policies.tenant_isolation` present with both `USING` and `WITH CHECK`;
   `quimia_app` grants present; the two composite FKs exist.

## AD-21 Ratification

AD-21 exists only in `review-adversarial-incompatibility.md` (F7) and was never
ratified; the spine documents AD-1..AD-12 only. This change ratifies it.

**Placement.** In
`_bmad-output/planning-artifacts/architecture/architecture-quimiaio-2026-07-28/ARCHITECTURE-SPINE.md`,
append the new subsection inside `## Invariants & Rules`, **immediately after
AD-12** (currently ending line 112) and **before `### Dependency direction`**
(line 114). It uses the same `### AD-<n> — <title> [ADOPTED]` / `Binds` /
`Prevents` / `Rule` shape as AD-1..AD-12. Numbering jumps to 21 deliberately
(AD-19/AD-20 remain owned by the review's F1–F2/F3 concurrency proposals, not
this change).

**Exact text to append:**

```markdown
### AD-21 — Container/tube catalog and label cardinality `[ADOPTED]`

- **Binds:** `catalog` (`Container`, `Study`), `orders` (FR-22 container labels), Epic 6 label printing (Story 6.4); FR-9
- **Prevents:** modelling `Study`↔`Container` as one tube per study (a scalar `tubeType`/`tubeColor` on `Study`, or a 1:N FK) — neither can express a study that needs two tubes (e.g. a chemistry panel drawing serum + a fluoride/oxalate tube), which would make Epic 6's print-preview silently under-print and a patient be drawn into the wrong tube.
- **Rule:**
  1. `Container` is a real admin-managed catalog entity (FR-9), not per-tube order identity (consistent with AD-6). It carries a nullable `color` — the tube colour (e.g. "amarillo"/"lila"/"rojo") that drives label printing — nullable because non-tube containers ("Frasco", "Laminilla") have no tube colour.
  2. `Study` ↔ `Container` is **many-to-many**, through the explicit join model `StudyContainer` (a study may require more than one tube).
  3. Epic 6 prints **one deduplicated label per distinct container** required across an order's studies, each carrying its study attribution and the catalog colour, with the folio barcode identical on every label (AD-6).
- **Corrects:** the `### Core-entity ERD` note that said `Study` needs a `tubeType`/`tubeColor` catalog attribute as "catalog data, not a new entity". The catalog data is `Container.color`, and study↔container cardinality is many-to-many, not a scalar on `Study`.
```

**ERD note correction.** Replace the bullet at line 236 of the same file
(currently: *"`Study` needs a `tubeType`/`tubeColor` catalog attribute (e.g.
amarillo/lila/rojo) to drive how many container labels print per order and in
which color (FR-22) — catalog data, not a new entity."*) with a superseded
pointer so the ERD stops contradicting FR-9:

```markdown
- ~~`Study` needs a `tubeType`/`tubeColor` catalog attribute … catalog data, not a new entity.~~ **Superseded by AD-21:** the catalog data is `Container.color`, and `Study`↔`Container` is many-to-many (`StudyContainer`). See AD-21.
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `Study` + `StudyContainer`; add `Container.color`; add `studies Study[]` back-relation to `Method`/`Technique`/`Equipment`/`SampleType` and `studyContainers StudyContainer[]` to `Container`; add `@@unique([id, tenantId])` to all six FK-target models |
| `prisma/migrations/<ts>_study/migration.sql` | Create | One migration: `ALTER TABLE container ADD color` + `CREATE TABLE study`/`study_container` + composite indexes/FKs + hand-appended `GRANT`/`ENABLE`+`FORCE RLS`/`tenant_isolation` for the two NEW tables. **LF** |
| `_bmad-output/.../ARCHITECTURE-SPINE.md` | Modify | Append AD-21 after AD-12; correct the ERD "not a new entity" note |
| `tests/integration/catalog/study-schema.test.ts` | Create | Column-set contract, defaults, `(tenantId, code)` uniqueness, Decimal fidelity, `equipmentId` NULL, cuid2 via `scoped()`, join is `study_container` (not `_StudyToContainer`), no-seed |
| `tests/integration/catalog/study-rls.test.ts` | Create | ENABLE+FORCE+policy on both new tables, fail-closed, cross-tenant isolation, owner-bypass (structural), `quimia_app` CRUD |
| `tests/integration/catalog/study-fk.test.ts` | Create | FK resolution against all five catalogs; `onDelete: Restrict`; deactivated row referenceable; **cross-tenant composite-FK rejection** for a scalar FK and for the join |
| `tests/integration/catalog/study-m2m.test.ts` | Create | Two distinct containers → two rows; duplicate link rejected; one link per distinct container |
| `tests/integration/catalog/container-color.test.ts` | Create | `color` persists; `NULL` for non-tube; `quimia_app` reads/writes `color` with no extra grant |
| `tests/integration/catalog/catalog-schema.test.ts` | Modify | The 2.1 `Container` column-set assertion (`LOCKED_COLUMNS`) must now include `color`, or it fails against the migrated schema |
| `openspec/specs/supporting-catalogs/spec.md` | Deferred to archive | Delta merges at archive time (sdd-archive); this change does not edit the main spec |

Untouched by design: `src/**` (no UI, actions, route, registry, or typed
queries), `src/shared/db/**` (wrapper is model-agnostic), audit constants,
seed data.

## Interfaces / Contracts

- **DB contract (new):** `study`/`study_container` tables with the composite FKs
  above; `container.color TEXT NULL`.
- **Prisma contract:** `Study`, `StudyContainer` models; the six composite
  relations; `@@unique([studyId, containerId])` as the duplicate-link guard
  (PK is single-column `id`).
- **`Container.color` value contract:** free-text human-readable name, `NULL`
  allowed. Name → swatch mapping and any app-level validation are **presentation
  / slice-2/2** concerns (ADR-4).
- **Forward reference only (not built here):** the future
  `catalog.getLabelSpecs(studyIds)` interface that `orders` calls (AD-1) returns a
  deduplicated set of distinct container requirements with study attribution and
  the catalog colour. It is named here only to anchor AD-21; it ships in Epic 6.
- **Unchanged contract:** `src/shared/db` `scoped()`/`transaction()` — the only DB
  path (AD-3). No new entry point, no new mode.

## Testing Strategy

Strict TDD is active (`openspec/config.yaml`, `strict_tdd: true`, runner
`vitest run`). Integration runner: `vitest.integration.config.ts` against a real
ephemeral Neon branch (`fileParallelism: false`, `testTimeout: 120_000`). A
mocked Prisma client is **not** accepted as RLS evidence.

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | N/A — no Zod schemas or domain logic ship in this slice | — |
| Integration (RED first) | All schema/RLS/FK/M2M/color scenarios below | Real ephemeral Neon branch; structural assertions via owner `pg` client; `scoped()` for cuid2/Prisma-path |
| E2E | N/A — no user-visible surface | Not run. This machine's Playwright `webServer` spawn hangs; slice 2/2 runs e2e manually (`npx tsx scripts/e2e/start-server.ts` + `E2E_REUSE_SERVER=1 npx playwright test`) |

### RED order (strict TDD)

1. **RED:** author `tests/integration/catalog/study-schema.test.ts` asserting the
   `study`/`study_container` tables and `container.color` exist with the exact
   column sets. It **fails** now (tables/column absent) — the migration does not yet
   exist. This is the first failing assertion.
2. **GREEN:** add the schema + migration; the file passes.
3. **RED → GREEN** for `study-rls`, `study-fk`, `study-m2m`, `container-color`,
   and the `catalog-schema.test.ts` update, one contract each.

### Integration coverage → spec scenario map

| Spec requirement | Test assertion on the real branch |
|---|---|
| R1 Study field contract | exact `study` column set; `@@unique([tenantId, code])`; `@@index([tenantId])`; snake_case `@@map`; required/nullable split |
| R1 defaults | `processDays=1`, `isActive=true`, `tax=false`, 4 print flags `false` |
| R1 name not unique | duplicate `name` + different `code` in one tenant inserts |
| R1 `equipmentId` NULL | study with `equipmentId=null` inserts |
| R1 Decimal fidelity | `price=1234.56` round-trips as `1234.56` (`Decimal(10,2)`) |
| R2 FK resolution | create a study referencing all five catalogs; each resolves |
| R2 FK to missing row | `methodId` to a non-existent id → `23503` |
| R2 cross-tenant FK | A's study referencing B's `method` → **`23503`** (composite FK; fails as written — see Disagreement 1) |
| R3 `onDelete: Restrict` | owner `DELETE` of a referenced `method` → `23503`; no cascade; deactivated row still referenceable |
| R4 per-tenant `code` uniqueness | same `code` within A → `23505`; same `code` across A/B allowed; duplicate `name` allowed |
| R5 explicit M2M | join is `study_container`; **no** `_StudyToContainer` table exists |
| R5 two containers → two rows | link serum + EDTA → exactly 2 rows |
| R5 duplicate link rejected | same `(studyId, containerId)` twice → `23505` |
| R5 cross-tenant link impossible | A-study → B-container insert → **`23503`** (composite FK) |
| R6 container color | `color="lila"` persists; `NULL` allowed; `quimia_app` reads/writes `color` with no extra grant |
| R7 lifecycle | deactivate → `isActive=false`, row persists; reactivate → `true` |
| R8 RLS on both tables | `pg_class.relforcerowsecurity=true`; `pg_policies.tenant_isolation` with `USING`+`WITH CHECK` on `app.tenant_id`; fail-closed; cross-tenant zero rows; owner-bypass structural check; `quimia_app` full CRUD |
| R9 real-branch evidence | every RLS assertion runs against the ephemeral branch; no mock |
| R10 no seed | migration contains no `INSERT`/`COPY` (static check, 2.1 precedent) |

Owner-bypass is proven **structurally** via `pg_class.relforcerowsecurity`
(same deviation the 2.1 RLS test documented): Neon's branch-owner role
demonstrably bypasses RLS on the harness, so the literal owner-SELECT-zero-rows
is not reproducible; `relforcerowsecurity = true` is the exact property that
removes the owner's implicit bypass.

## Threat Matrix

**N/A — no routing, shell-command authoring, subprocess, VCS/PR automation,
executable-file classification, or process-integration boundary.** This change
adds DDL applied through the project's pre-existing Prisma CLI workflow; it does
not introduce or modify any command routing, subprocess integration, git/PR
automation, or executable-file classification. The `references/threat-matrix.md`
rows (documentation-like paths, git repository selection, commit state, push
state, PR commands) do not apply. The one operational hazard — LF line endings
on `migration.sql` — is addressed as a migration step (ADR-5), not a threat-matrix
row.

## Migration / Rollout

- **No data migration.** Greenfield tables; no consumers and no rows exist (no
  UI/actions ship here). `container.color` is additive and nullable.
- **Rollout:** one owner-role `migrate deploy` on the target branch (dev branch
  first, then the ephemeral test branch via the harness). No feature flag needed —
  nothing reads the tables at runtime yet.
- **Rollback:** on a shared/long-lived branch, with the owner role:
  `DROP TABLE "study_container"; DROP TABLE "study";` then
  `ALTER TABLE "container" DROP COLUMN "color";` and drop the six composite
  indexes/FKs. No rows to lose. `git revert` the schema + migration + spine edits,
  or delete the ephemeral branch. Back-relations and composite keys are
  schema-only.

## Explicit Non-Leakage (slice 2/2 stays out)

`configuracion-study-crud` owns, and this design does **not** introduce:

- **No UI:** no form, dialog, table, or `/configuracion/estudios` route.
- **No server actions** and no `"use server"` wrappers.
- **No registry wiring:** how Study joins `CATALOGS`/`registry.ts` and the
  `/configuracion` hub card (D11) is slice 2/2.
- **No audit writes:** no `STUDY_*` action constants and no AuditLog write path
  (AD-10 binds slice 2/2).
- **No Zod schemas, no admin guard, no typed queries.**
- **No `Study` ↔ `Analyte` link** (D10 — Story 2.3).
- **No e2e**, **no seed data**.

Enforcement: the only files this change touches are `prisma/schema.prisma`, the
new migration, `ARCHITECTURE-SPINE.md`, and `tests/integration/catalog/**`. A
diff review confirming "no files under `src/`" is the non-leakage gate.

## Spec ↔ Design Disagreements

These are surfaced, not silently resolved.

1. **"Cross-tenant FK resolution is structurally impossible" is false under the
   spec's own stated mechanism.** `study-catalog/spec.md` requirement 2 (and the
   proposal, lines 119–121) justify this with "the referenced catalog row is
   itself RLS-hidden" — but PostgreSQL RI checks **bypass RLS** (documented), so a
   plain FK *does* resolve to another tenant's row. **Design response:** satisfy
   the requirement the only way it can be satisfied — composite FKs (ADR-3). The
   spec's *requirement* stands; its *mechanism sentence* is corrected. The RED
   test for scenario "Study cannot reference another tenant's catalog row" would
   **fail under a plain FK** and **passes under the composite FK**.
2. **The `supporting-catalogs` delta does not enumerate `@@unique([id, tenantId])`
   on the five catalog models.** ADR-3 requires it (index-only, no new column, so
   the "no further persisted field" clause is not literally violated), but the
   delta's scenario "Study back-relations add no column" implies the only catalog
   changes are the back-relations and `Container.color`. **Requested:** amend the
   `supporting-catalogs` delta to name the composite-key index on all five models,
   so the catalog schema change is fully enumerated before apply.
3. **The proposal's Study field table (lines 92–111) shows plain single-column
   FKs; this design makes them composite.** Requirement 2 of the spec cannot be
   met otherwise (Disagreement 1). Flagged for ratification; the composite shape
   is otherwise identical to the table (same columns, same `onDelete: Restrict`).

## Open Questions

- [ ] **Ratify the composite-FK deviation** (Disagreement 3) or accept that
      requirement 2's "structurally impossible" is only an app-boundary property
      (RLS + the scoped wrapper) and restate the spec accordingly. Design
      recommends the composite FK.
- [ ] **Amend the `supporting-catalogs` delta** to enumerate `@@unique([id,
      tenantId])` (Disagreement 2).
- [ ] **Tax-inclusive vs tax-exclusive price** — remains open, deferred to Epic 6
      / the client's accountant (D3); not decided here.
- [ ] **`StudyContainer` timestamps** — this design omits `createdAt`/`updatedAt`
      to match the spec's exact field enumeration; confirm that is intended (a
      link's age is otherwise unrecorded).
- [ ] **Prisma expressiveness verification** — confirm Prisma 7 accepts the same
      scalar field (`tenantId`) participating in two relations on `StudyContainer`
      and four on `Study` (issue precedent: multiple relations on one field are
      supported with distinct `map` names). Verify with `prisma validate` during
      apply; if it is rejected, escalate rather than hand-writing FKs (which would
      create schema↔migration drift).
